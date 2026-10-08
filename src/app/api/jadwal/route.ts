import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { DayOfWeek } from "@prisma/client";
import { sesiApi, butuhLogin, tolak, dojoIdsUntukSensei } from "@/lib/api-auth";
import { jadwalCreateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasiSiswaDojo } from "@/lib/notifikasi";
import { NAMA_HARI } from "@/lib/format";

const PER_HALAMAN_MAKS = 50;
const HARI_VALID = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"];

/**
 * GET /api/jadwal — daftar jadwal latihan.
 * Admin: semua (scope dojo bila admin dojo) + filter dojo/hari/status.
 * Sensei: hanya jadwal di dojo tanggung jawabnya. Siswa: hanya jadwal aktif dojonya.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const sp = new URL(req.url).searchParams;
  const hari = sp.get("hari")?.trim() ?? "";
  const aktif = sp.get("aktif")?.trim() ?? "";
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "20", 10) || 20)
  );

  const where: Prisma.ScheduleWhereInput = {};
  if (hari && HARI_VALID.includes(hari)) where.hari = hari as DayOfWeek;
  if (aktif === "true") where.isActive = true;
  else if (aktif === "false") where.isActive = false;

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.get("dojo")) {
      where.dojoId = sp.get("dojo")!;
    }
  } else if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    const filterDojo = sp.get("dojo");
    const dipilih = filterDojo && ids.includes(filterDojo) ? [filterDojo] : ids;
    where.dojoId = { in: dipilih.length > 0 ? dipilih : ["__kosong__"] };
  } else {
    // SISWA: hanya jadwal aktif di dojonya (§59.14)
    if (!u.studentId) return tolak("Akun siswa belum terhubung ke data siswa.");
    const siswa = await prisma.student.findUnique({
      where: { id: u.studentId },
      select: { dojoId: true },
    });
    if (!siswa) return tolak("Data siswa tidak ditemukan.");
    where.dojoId = siswa.dojoId;
    where.isActive = true;
  }

  const [total, data] = await Promise.all([
    prisma.schedule.count({ where }),
    prisma.schedule.findMany({
      where,
      orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      include: {
        dojo: {
          select: { id: true, nama: true, latitude: true, longitude: true, radiusAbsensi: true },
        },
        coach: { select: { id: true, nama: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data,
    meta: { halaman, perHalaman, total, totalHalaman: Math.max(1, Math.ceil(total / perHalaman)) },
  });
}

/** POST /api/jadwal — tambah jadwal (admin only, §12). */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menambah jadwal.");

  const body = await req.json().catch(() => null);
  const parsed = jadwalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data jadwal tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.scopeDojoId && data.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat menambah jadwal di dojo Anda.");

  const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
  if (!dojo || !dojo.isActive)
    return NextResponse.json({ error: "Dojo tidak ditemukan atau tidak aktif." }, { status: 400 });

  if (data.coachId) {
    const coach = await prisma.coach.findUnique({ where: { id: data.coachId } });
    if (!coach || !coach.isActive)
      return NextResponse.json({ error: "Sensei tidak ditemukan atau tidak aktif." }, { status: 400 });
    if (coach.dojoId && coach.dojoId !== data.dojoId)
      return NextResponse.json(
        { error: "Sensei tersebut terdaftar di dojo lain." },
        { status: 400 }
      );
  }

  const dibuat = await prisma.schedule.create({ data });
  await catatAudit(u.id, "TAMBAH_JADWAL", "Schedule", dibuat.id, {
    namaLatihan: dibuat.namaLatihan,
    hari: dibuat.hari,
    jam: `${dibuat.jamMulai}-${dibuat.jamSelesai}`,
  });
  // Kabari siswa dojo terkait (§43). Best-effort: tak menggagalkan respons.
  void kirimNotifikasiSiswaDojo(
    dibuat.dojoId,
    "Jadwal latihan baru",
    `Jadwal latihan baru: ${dibuat.namaLatihan}, ${NAMA_HARI[dibuat.hari] ?? dibuat.hari} ${dibuat.jamMulai}-${dibuat.jamSelesai}.`,
    "JADWAL"
  );
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
