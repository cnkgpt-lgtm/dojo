import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { penilaianSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/** Ambil penilaian + pastikan pemanggil berhak melihatnya. */
async function muatTerlihat(id: string, u: NonNullable<Awaited<ReturnType<typeof sesiApi>>>) {
  const data = await prisma.studentAssessment.findUnique({
    where: { id },
    include: { student: { select: { id: true, dojoId: true, nama: true } } },
  });
  if (!data) return null;
  if (u.role === "SISWA" && u.studentId !== data.studentId) return null;
  if (u.role === "ADMIN" && u.scopeDojoId && data.student.dojoId !== u.scopeDojoId) return null;
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!ids.includes(data.student.dojoId)) return null;
  }
  return data;
}

/** GET /api/penilaian/[id] — detail penilaian. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await params;
  const data = await muatTerlihat(id, u);
  if (!data) return tidakKetemu("Data penilaian tidak ditemukan.");
  return NextResponse.json({ data });
}

/**
 * PATCH /api/penilaian/[id] — ubah penilaian.
 * Hanya sensei pembuat penilaian (admin read-only, §6).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "SENSEI" || !u.coachId) {
    return tolak("Hanya sensei pembuat penilaian yang dapat mengubahnya.");
  }
  const { id } = await params;
  const lama = await prisma.studentAssessment.findUnique({ where: { id } });
  if (!lama || lama.coachId !== u.coachId) {
    return tidakKetemu("Data penilaian tidak ditemukan.");
  }

  const body = await req.json().catch(() => null);
  const parsed = penilaianSchema
    .omit({ studentId: true, periode: true })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  try {
    const diubah = await prisma.studentAssessment.update({ where: { id }, data: parsed.data });
    await catatAudit(u.id, "UBAH_PENILAIAN", "StudentAssessment", id, { periode: lama.periode });
    return NextResponse.json({ data: diubah });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return tidakKetemu("Data penilaian tidak ditemukan.");
    }
    throw e;
  }
}

/**
 * DELETE /api/penilaian/[id] — hapus penilaian.
 * Hanya sensei pembuat penilaian (admin read-only, §6).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "SENSEI" || !u.coachId) {
    return tolak("Hanya sensei pembuat penilaian yang dapat menghapusnya.");
  }
  const { id } = await params;
  const lama = await prisma.studentAssessment.findUnique({ where: { id } });
  if (!lama || lama.coachId !== u.coachId) {
    return tidakKetemu("Data penilaian tidak ditemukan.");
  }
  await prisma.studentAssessment.delete({ where: { id } });
  await catatAudit(u.id, "HAPUS_PENILAIAN", "StudentAssessment", id, { periode: lama.periode });
  return NextResponse.json({ ok: true });
}
