import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { penilaianSchema, ASPEK_KEYS } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { getSkalaPenilaian } from "@/lib/sabuk";

async function dojoIdsTerlihat(u: Awaited<ReturnType<typeof sesiApi>>): Promise<string[] | null> {
  if (!u) return null;
  if (u.role === "ADMIN") return u.scopeDojoId ? [u.scopeDojoId] : [];
  if (u.role === "SENSEI") return dojoIdsUntukSensei(u.coachId);
  return null;
}

/**
 * GET /api/penilaian?studentId=&periode= — daftar penilaian (§35).
 * Siswa: miliknya sendiri. Sensei: siswa dojonya. Admin: sesuai scope (read-only).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId")?.trim() || undefined;
  const periode = searchParams.get("periode")?.trim() || undefined;

  if (u.role === "SISWA") {
    if (!u.studentId) return tolak("Akun Anda tidak terhubung ke data siswa.");
    if (studentId && studentId !== u.studentId) {
      return tolak("Anda hanya dapat melihat penilaian milik sendiri.");
    }
  }

  const where: Prisma.StudentAssessmentWhereInput = {};
  if (u.role === "SISWA" || studentId) where.studentId = u.role === "SISWA" ? u.studentId! : studentId;
  if (periode) where.periode = periode;

  const ids = await dojoIdsTerlihat(u);
  if (ids === null && u.role !== "SISWA") return tolak("Akses ditolak.");
  const skala = await getSkalaPenilaian();
  if (ids && ids.length === 0 && u.role !== "ADMIN") {
    return NextResponse.json({ data: [], skala });
  }
  if (ids && ids.length > 0) where.student = { dojoId: { in: ids } };

  const data = await prisma.studentAssessment.findMany({
    where,
    orderBy: [{ periode: "desc" }, { createdAt: "desc" }],
    include: {
      student: { select: { id: true, nama: true, memberId: true, dojo: { select: { nama: true } } } },
      coach: { select: { nama: true } },
    },
    take: 200,
  });

  return NextResponse.json({ data, skala });
}

/**
 * POST /api/penilaian — catat penilaian perkembangan (§35).
 * Hanya SENSEI untuk siswa dojonya. Satu penilaian per siswa per periode.
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "SENSEI" || !u.coachId) {
    return tolak("Hanya sensei yang dapat memberikan penilaian.");
  }

  const body = await req.json().catch(() => null);
  const parsed = penilaianSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const ids = await dojoIdsUntukSensei(u.coachId);
  const siswa = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, nama: true, dojoId: true, status: true },
  });
  if (!siswa) return tidakKetemu("Data siswa tidak ditemukan.");
  if (!ids.includes(siswa.dojoId)) {
    return tolak("Anda hanya dapat menilai siswa dojo Anda.");
  }

  const adaNilai = ASPEK_KEYS.some((k) => data[k] != null);
  if (!adaNilai) {
    return NextResponse.json(
      { error: "Isi minimal satu aspek penilaian." },
      { status: 400 }
    );
  }

  try {
    const dibuat = await prisma.studentAssessment.create({
      data: {
        studentId: data.studentId,
        coachId: u.coachId,
        tanggal: new Date(`${data.periode}-01T00:00:00`),
        periode: data.periode,
        kihon: data.kihon,
        kata: data.kata,
        kumite: data.kumite,
        fisik: data.fisik,
        disiplin: data.disiplin,
        sikap: data.sikap,
        kehadiran: data.kehadiran,
        teknik: data.teknik,
        catatan: data.catatan?.trim() || null,
      },
    });
    await catatAudit(u.id, "TAMBAH_PENILAIAN", "StudentAssessment", dibuat.id, {
      siswa: siswa.nama,
      periode: data.periode,
    });
    return NextResponse.json({ data: dibuat }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Penilaian untuk siswa dan periode ini sudah ada." },
        { status: 409 }
      );
    }
    throw e;
  }
}
