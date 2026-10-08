import { NextResponse } from "next/server";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { laporanIuran } from "@/lib/laporan";

/**
 * GET /api/laporan/iuran — matriks siswa × bulan (§31).
 * Param: periodeAwal, periodeAkhir (YYYY-MM), dojo (admin pusat),
 * q (nama/Member ID), status (filter).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat laporan iuran.");

  const sp = new URL(req.url).searchParams;
  const data = await laporanIuran({
    periodeAwal: sp.get("periodeAwal") ?? undefined,
    periodeAkhir: sp.get("periodeAkhir") ?? undefined,
    dojoId: u.scopeDojoId ?? sp.get("dojo")?.trim() ?? undefined,
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ data });
}
