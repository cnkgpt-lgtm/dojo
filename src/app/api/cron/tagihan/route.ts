import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buatTagihanPeriode, periodeBerjalan, labelPeriode } from "@/lib/iuran";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { rupiah } from "@/lib/format";

/**
 * POST /api/cron/tagihan — generate tagihan periode berjalan untuk SEMUA dojo aktif (§67).
 * Diproteksi CRON_SECRET via header `Authorization: Bearer <CRON_SECRET>`.
 * Dipanggil scheduler eksternal (mis. Vercel Cron, 1x per bulan) — lihat README.
 * Fail-closed: tanpa CRON_SECRET yang cocok, selalu 401/500.
 */
export async function POST(req: Request) {
  const rahasia = process.env.CRON_SECRET;
  if (!rahasia) {
    return NextResponse.json(
      { error: "CRON_SECRET belum dikonfigurasi di server." },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${rahasia}`) {
    return NextResponse.json({ error: "Tidak diotorisasi." }, { status: 401 });
  }

  const periode = periodeBerjalan();
  const dojos = await prisma.dojo.findMany({ where: { isActive: true }, select: { id: true } });
  const hasil = await buatTagihanPeriode(
    periode,
    dojos.map((d) => d.id),
    async (userId, p, nominal) => {
      await kirimNotifikasi(
        userId,
        `Tagihan iuran ${labelPeriode(p)}`,
        `Tagihan iuran ${labelPeriode(p)} sebesar ${rupiah(nominal)} telah dibuat. Segera lakukan pembayaran sebelum jatuh tempo.`,
        "IURAN"
      );
    }
  );

  return NextResponse.json({ periode, data: hasil });
}
