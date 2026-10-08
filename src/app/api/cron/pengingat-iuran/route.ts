import { NextResponse } from "next/server";
import { kirimPengingatIuran } from "@/lib/pengingat";

/**
 * POST /api/cron/pengingat-iuran — kirim pengingat iuran H-7 / H-1 / hari jatuh tempo (§25, §67).
 * Diproteksi CRON_SECRET via header `Authorization: Bearer <CRON_SECRET>`,
 * pola sama dengan /api/cron/tagihan. Dipanggil scheduler eksternal 1x per hari.
 * Fail-closed: tanpa CRON_SECRET yang cocok, selalu 401/500.
 * IDEMPOTEN: pemanggilan ulang di hari yang sama tidak mengirim duplikat
 * (unique userId+tipe+refId pada Notification).
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

  const hasil = await kirimPengingatIuran();
  return NextResponse.json({ data: hasil });
}
