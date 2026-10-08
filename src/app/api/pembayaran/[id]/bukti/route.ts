import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { sajikanFile } from "@/lib/file-proxy";

export const dynamic = "force-dynamic";

/**
 * GET /api/pembayaran/[id]/bukti — tampilkan bukti transfer lewat proxy
 * server-side (token bot Telegram tak pernah terekspos ke browser).
 * Boleh: ADMIN (scope dojo) + siswa pemilik pembayaran.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await ctx.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      proof: { select: { url: true } },
      invoice: { select: { dojoId: true } },
    },
  });
  if (!payment) return tidakKetemu("Pembayaran tidak ditemukan.");

  if (u.role === "ADMIN") {
    if (u.scopeDojoId && payment.invoice.dojoId !== u.scopeDojoId)
      return tolak("Pembayaran ini di luar cakupan dojo Anda.");
  } else if (u.role === "SISWA") {
    if (!u.studentId || payment.studentId !== u.studentId)
      return tolak("Bukti ini bukan milik Anda.");
  } else {
    return tolak("Anda tidak berhak melihat bukti ini.");
  }

  return sajikanFile(payment.proof?.url, `bukti-${id}`);
}
