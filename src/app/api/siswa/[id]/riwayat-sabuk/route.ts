import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";

/**
 * GET /api/siswa/[id]/riwayat-sabuk — riwayat kenaikan sabuk seorang siswa (§34).
 * Siswa: miliknya sendiri. Sensei: siswa dojonya. Admin: sesuai scope dojo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const { id: studentId } = await params;
  if (u.role === "SISWA" && u.studentId !== studentId) {
    return tolak("Anda hanya dapat melihat riwayat sabuk milik sendiri.");
  }

  const siswa = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, dojoId: true },
  });
  if (!siswa) return tidakKetemu("Data siswa tidak ditemukan.");

  if (u.role === "ADMIN" && u.scopeDojoId && siswa.dojoId !== u.scopeDojoId) {
    return tolak("Siswa ini di luar dojo yang menjadi tanggung jawab Anda.");
  }
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!ids.includes(siswa.dojoId)) {
      return tolak("Anda hanya dapat melihat riwayat sabuk siswa dojo Anda.");
    }
  }

  const riwayat = await prisma.studentBeltHistory.findMany({
    where: { studentId },
    orderBy: { tanggal: "desc" },
    include: {
      sabukLama: { select: { nama: true, warnaHex: true } },
      sabukBaru: { select: { nama: true, warnaHex: true } },
      penguji: { select: { name: true } },
    },
  });

  return NextResponse.json({ data: riwayat });
}
