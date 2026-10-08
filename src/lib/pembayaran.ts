import { Prisma } from "@prisma/client";
import { pastikanKategoriIuran } from "./iuran";

/**
 * Bentuk record pemasukan dari pembayaran iuran yang LUNAS (§27, §29).
 * Dipanggil di dalam transaksi yang sama dengan pelunasan (§49: anti-duplikat
 * via paymentId unique di Revenue — P2002 berarti revenue sudah tercatat).
 */

type Tx = Prisma.TransactionClient;

export async function catatRevenueIuran(
  tx: Tx,
  args: {
    paymentId: string;
    dojoId: string;
    nominal: number;
    metode: "TUNAI" | "TRANSFER";
    petugasId: string | null;
    deskripsi: string;
    tanggal: Date;
  }
): Promise<void> {
  const kategoriId = await pastikanKategoriIuran(tx);
  await tx.revenue.create({
    data: {
      dojoId: args.dojoId,
      tanggal: args.tanggal,
      kategoriId,
      deskripsi: args.deskripsi,
      nominal: args.nominal,
      metode: args.metode,
      petugasId: args.petugasId,
      paymentId: args.paymentId,
    },
  });
}
