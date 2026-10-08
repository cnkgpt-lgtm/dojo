import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { StudentStatus } from "@prisma/client";
import { sesiApi, butuhLogin, tolak, dojoIdsUntukSensei } from "@/lib/api-auth";
import { siswaCreateSchema } from "@/lib/validasi";
import { kandidatMemberId } from "@/lib/member-id";
import { catatAudit } from "@/lib/audit";

const PER_HALAMAN_MAKS = 50;

/**
 * GET /api/siswa — daftar siswa.
 * Admin: semua (scope dojo bila admin dojo) + search nama/Member ID + filter dojo & status + pagination.
 * Sensei: hanya siswa dojo tanggung jawabnya (§59.15). Siswa: ditolak (§59.14).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role === "SISWA") return tolak("Akun siswa hanya dapat melihat profil sendiri.");

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "10", 10) || 10)
  );

  const where: Prisma.StudentWhereInput = {};
  if (q) {
    where.OR = [
      { nama: { contains: q, mode: "insensitive" } },
      { memberId: { contains: q, mode: "insensitive" } },
    ];
  }
  const STATUS_VALID: string[] = ["AKTIF", "TIDAK_AKTIF", "CUTI", "KELUAR"];
  if (status && STATUS_VALID.includes(status)) where.status = status as StudentStatus;

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.get("dojo")) {
      where.dojoId = sp.get("dojo")!;
    }
  } else {
    // SENSEI
    const ids = await dojoIdsUntukSensei(u.coachId);
    const filterDojo = sp.get("dojo");
    const dipilih = filterDojo && ids.includes(filterDojo) ? [filterDojo] : ids;
    where.dojoId = { in: dipilih.length > 0 ? dipilih : ["__kosong__"] };
  }

  const [total, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { nama: "asc" },
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      include: { dojo: { select: { id: true, nama: true } }, sabuk: { select: { id: true, nama: true } } },
    }),
  ]);

  return NextResponse.json({
    data,
    meta: { halaman, perHalaman, total, totalHalaman: Math.max(1, Math.ceil(total / perHalaman)) },
  });
}

/**
 * POST /api/siswa — tambah siswa (admin only).
 * Member ID dibuat otomatis di server: KRT-XXXXXX, unik (§9, §59.1).
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menambah siswa.");

  const body = await req.json().catch(() => null);
  const parsed = siswaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data siswa tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.scopeDojoId && data.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat menambah siswa di dojo Anda.");
  const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
  if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  if (data.sabukId) {
    const sabuk = await prisma.belt.findUnique({ where: { id: data.sabukId } });
    if (!sabuk) return NextResponse.json({ error: "Sabuk tidak ditemukan." }, { status: 400 });
  }

  // Buat Member ID unik dengan retry bila terjadi tabrakan (§49 anti-duplikat).
  let dibuat = null;
  for (let i = 0; i < 5 && !dibuat; i++) {
    const memberId = await kandidatMemberId(i);
    try {
      dibuat = await prisma.student.create({ data: { ...data, memberId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  if (!dibuat)
    return NextResponse.json({ error: "Gagal membuat Member ID unik. Coba lagi." }, { status: 409 });

  await catatAudit(u.id, "TAMBAH_SISWA", "Student", dibuat.id, {
    nama: dibuat.nama,
    memberId: dibuat.memberId,
  });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
