import { NextResponse } from "next/server";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { laporanKeuangan } from "@/lib/laporan";

/**
 * GET /api/laporan/keuangan — laporan keuangan (§30, §66).
 * Filter: dari, sampai (YYYY-MM-DD), dojo (admin pusat), kategori, metode.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat laporan keuangan.");

  const sp = new URL(req.url).searchParams;
  const data = await laporanKeuangan({
    dari: sp.get("dari")?.trim() || undefined,
    sampai: sp.get("sampai")?.trim() || undefined,
    dojoId: u.scopeDojoId ?? sp.get("dojo")?.trim() ?? undefined,
    kategoriId: sp.get("kategori")?.trim() || undefined,
    metode: sp.get("metode")?.trim() || undefined,
  });
  return NextResponse.json({ data });
}
