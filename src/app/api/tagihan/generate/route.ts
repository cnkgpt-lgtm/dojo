import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { generateTagihanSchema } from "@/lib/validasi";
import { buatTagihanPeriode, labelPeriode } from "@/lib/iuran";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { catatAudit } from "@/lib/audit";
import { rupiah } from "@/lib/format";

/**
 * POST /api/tagihan/generate — buat tagihan bulanan (§19).
 * Admin only; idempoten via unique(studentId, periode).
 * Body: { periode: "2026-11", dojoId? }
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat membuat tagihan.");

  const body = await req.json().catch(() => null);
  const parsed = generateTagihanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }
  const { periode, dojoId } = parsed.data;

  // Tentukan cakupan dojo.
  let dojoIds: string[];
  if (u.scopeDojoId) {
    if (dojoId && dojoId !== u.scopeDojoId)
      return tolak("Anda hanya dapat membuat tagihan untuk dojo Anda.");
    dojoIds = [u.scopeDojoId];
  } else if (dojoId) {
    const ada = await prisma.dojo.findUnique({ where: { id: dojoId }, select: { id: true } });
    if (!ada) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
    dojoIds = [dojoId];
  } else {
    const semua = await prisma.dojo.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    dojoIds = semua.map((d) => d.id);
  }
  if (dojoIds.length === 0)
    return NextResponse.json({ error: "Tidak ada dojo aktif." }, { status: 400 });

  const hasil = await buatTagihanPeriode(periode, dojoIds, async (userId, p, nominal) => {
    await kirimNotifikasi(
      userId,
      `Tagihan iuran ${labelPeriode(p)}`,
      `Tagihan iuran ${labelPeriode(p)} sebesar ${rupiah(nominal)} telah dibuat. Segera lakukan pembayaran sebelum jatuh tempo.`,
      "IURAN"
    );
  });

  await catatAudit(u.id, "GENERATE_TAGIHAN", "Invoice", undefined, { periode, ...hasil });

  return NextResponse.json({
    data: hasil,
    pesan: `Tagihan ${labelPeriode(periode)}: ${hasil.dibuat} dibuat, ${hasil.sudahAda} sudah ada, ${hasil.tanpaTarif} dilewati (tanpa tarif).`,
  });
}
