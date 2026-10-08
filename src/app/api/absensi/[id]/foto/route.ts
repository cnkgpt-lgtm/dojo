import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { sajikanFile } from "@/lib/file-proxy";

export const dynamic = "force-dynamic";

/**
 * GET /api/absensi/[id]/foto — tampilkan selfie absensi lewat proxy
 * server-side (token bot Telegram tak pernah terekspos ke browser).
 * Boleh: ADMIN (scope dojo) + SENSEI (dojo tanggung jawabnya) + siswa pemilik.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await ctx.params;

  const absensi = await prisma.attendance.findUnique({
    where: { id },
    include: { photo: { select: { url: true } } },
  });
  if (!absensi) return tidakKetemu("Data absensi tidak ditemukan.");

  if (u.role === "ADMIN") {
    if (u.scopeDojoId && absensi.dojoId !== u.scopeDojoId)
      return tolak("Absensi ini di luar cakupan dojo Anda.");
  } else if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!ids.includes(absensi.dojoId)) return tolak("Absensi ini di luar dojo Anda.");
  } else if (u.role === "SISWA") {
    if (!u.studentId || absensi.studentId !== u.studentId)
      return tolak("Foto ini bukan milik Anda.");
  } else {
    return tolak("Anda tidak berhak melihat foto ini.");
  }

  return sajikanFile(absensi.photo?.url, `selfie-${id}`);
}
