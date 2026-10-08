import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { AttendanceStatus } from "@prisma/client";
import { sesiApi, butuhLogin, tolak, dojoIdsUntukSensei } from "@/lib/api-auth";
import { simpanFoto, hapusFotoLama } from "@/lib/upload";
import {
  sekarangMakassar,
  statusJendela,
  statusKehadiran,
  haversineMeter,
} from "@/lib/absensi";

const PER_HALAMAN_MAKS = 50;
const STATUS_VALID = ["HADIR", "TERLAMBAT", "DITOLAK", "DIBATALKAN"];

/**
 * GET /api/absensi — daftar absensi.
 * Admin: filter tanggal/dojo/status/jadwal + pagination (scope dojo bila admin dojo).
 * Sensei: hanya absensi jadwal di dojo tanggung jawabnya.
 * Siswa: hanya miliknya sendiri (+ filter bulan YYYY-MM).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const sp = new URL(req.url).searchParams;
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "20", 10) || 20)
  );

  const where: Prisma.AttendanceWhereInput = {};
  const status = sp.get("status")?.trim() ?? "";
  if (status && STATUS_VALID.includes(status)) where.status = status as AttendanceStatus;

  const tanggal = sp.get("tanggal")?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    const [y, m, d] = tanggal.split("-").map(Number);
    where.tanggal = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  const bulan = sp.get("bulan")?.trim() ?? "";
  if (/^\d{4}-\d{2}$/.test(bulan)) {
    const [y, m] = bulan.split("-").map(Number);
    const awal = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
    const akhir = new Date(Date.UTC(y, m, 1, 12, 0, 0));
    where.tanggal = { gte: awal, lt: akhir };
  }

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.get("dojo")) {
      where.dojoId = sp.get("dojo")!;
    }
  } else if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    const daftar = ids.length > 0 ? ids : ["__kosong__"];
    const filterDojo = sp.get("dojo");
    where.dojoId = filterDojo && daftar.includes(filterDojo) ? filterDojo : { in: daftar };
  } else {
    if (!u.studentId) return tolak("Akun siswa belum terhubung ke data siswa.");
    where.studentId = u.studentId;
  }

  const jadwalId = sp.get("jadwal")?.trim() ?? "";
  if (jadwalId) where.scheduleId = jadwalId;

  const q = sp.get("q")?.trim() ?? "";
  if (q && u.role !== "SISWA") {
    where.student = {
      OR: [
        { nama: { contains: q, mode: "insensitive" } },
        { memberId: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [total, data] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      orderBy: [{ tanggal: "desc" }, { jam: "desc" }],
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      include: {
        student: { select: { id: true, nama: true, memberId: true, foto: true } },
        schedule: {
          select: { id: true, namaLatihan: true, hari: true, jamMulai: true, jamSelesai: true },
        },
        dojo: { select: { id: true, nama: true } },
        photo: { select: { url: true } },
        location: { select: { latitude: true, longitude: true, jarakMeter: true, statusGps: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data,
    meta: { halaman, perHalaman, total, totalHalaman: Math.max(1, Math.ceil(total / perHalaman)) },
  });
}

/**
 * POST /api/absensi — catat kehadiran siswa (multipart: scheduleId, latitude,
 * longitude, foto). SELURUH validasi di server (§13–§17, §59.2–7, §60):
 * identitas siswa, jadwal aktif (zona Asia/Makassar), radius GPS, anti-duplikat.
 * Upaya yang ditolak TIDAK disimpan (agar tak menghalangi percobaan valid berikutnya).
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "SISWA" || !u.studentId)
    return tolak("Hanya siswa yang dapat melakukan absensi untuk dirinya sendiri.");

  const form = await req.formData().catch(() => null);
  const scheduleId = String(form?.get("scheduleId") ?? "").trim();
  const latitude = Number(form?.get("latitude"));
  const longitude = Number(form?.get("longitude"));
  const file = form?.get("foto");

  if (!scheduleId)
    return NextResponse.json({ error: "Jadwal latihan wajib dipilih." }, { status: 400 });
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "Lokasi tidak dapat ditemukan. Silakan aktifkan GPS." },
      { status: 422 }
    );
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Foto selfie wajib diambil." }, { status: 400 });
  }

  const siswa = await prisma.student.findUnique({ where: { id: u.studentId } });
  if (!siswa) return tolak("Data siswa tidak ditemukan.");
  if (siswa.status !== "AKTIF")
    return tolak("Hanya siswa aktif yang dapat melakukan absensi.");

  const jadwal = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { dojo: true },
  });
  if (!jadwal || !jadwal.isActive || !jadwal.dojo.isActive)
    return NextResponse.json(
      { error: "Jadwal tidak ditemukan atau sudah tidak aktif." },
      { status: 404 }
    );
  if (jadwal.dojoId !== siswa.dojoId)
    return tolak("Jadwal ini bukan jadwal dojo Anda.");

  // Validasi waktu: hari & jendela absensi menurut zona Asia/Makassar (§15).
  const w = sekarangMakassar();
  if (w.hari !== jadwal.hari) {
    return NextResponse.json({ error: "Tidak ada sesi jadwal ini hari ini." }, { status: 422 });
  }
  const jendela = statusJendela(jadwal.jamMulai, jadwal.jamSelesai, jadwal.toleransiMenit, w.menit);
  if (jendela === "BELUM_DIBUKA") {
    return NextResponse.json({ error: "Absensi belum dibuka." }, { status: 422 });
  }
  if (jendela === "DITUTUP") {
    return NextResponse.json({ error: "Absensi telah ditutup." }, { status: 422 });
  }

  // Validasi GPS: jarak haversine vs radius dojo (§14).
  const jarak = haversineMeter(latitude, longitude, jadwal.dojo.latitude, jadwal.dojo.longitude);
  if (jarak > jadwal.dojo.radiusAbsensi) {
    return NextResponse.json({ error: "Anda berada di luar area latihan." }, { status: 422 });
  }

  // Simpan selfie (validasi magic bytes, maks 2MB — lihat lib/upload).
  const simpan = await simpanFoto(file, "absensi");
  if (!simpan.ok) return NextResponse.json({ error: simpan.error }, { status: 400 });

  const status = statusKehadiran(jadwal.jamMulai, w.menit);
  try {
    const dibuat = await prisma.attendance.create({
      data: {
        studentId: siswa.id,
        dojoId: siswa.dojoId,
        scheduleId: jadwal.id,
        tanggal: w.tanggal,
        jam: w.jam,
        status,
        photo: { create: { url: simpan.url } },
        location: {
          create: {
            latitude,
            longitude,
            jarakMeter: Math.round(jarak),
            statusGps: "VALID",
          },
        },
      },
      include: {
        photo: { select: { url: true } },
        location: { select: { jarakMeter: true, statusGps: true } },
      },
    });
    return NextResponse.json(
      { data: dibuat, message: "Absensi berhasil." },
      { status: 201 }
    );
  } catch (e) {
    // Duplikat: unique(studentId, scheduleId, tanggal) — termasuk race antar request (§49).
    await hapusFotoLama(simpan.url);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Anda sudah absen untuk jadwal ini." },
        { status: 409 }
      );
    }
    throw e;
  }
}
