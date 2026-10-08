import { prisma, Prisma } from "./db";
import { hariIniMakassar, labelPeriode } from "./iuran";
import { rupiah } from "./format";

/**
 * Pengingat iuran otomatis Phase 7 (§25, §67).
 * Dijalankan via POST /api/cron/pengingat-iuran (scheduler eksternal).
 * Zona waktu: Asia/Makassar. IDEMPOTEN via unique(userId, tipe, refId).
 */

export type JenisPengingat = "H-7" | "H-1" | "H-0";

const PESAN: Record<JenisPengingat, string> = {
  "H-7": "Iuran bulan ini akan jatuh tempo.",
  "H-1": "Besok adalah batas pembayaran iuran.",
  "H-0": "Iuran Anda belum dibayar.",
};

/**
 * Tentukan jenis pengingat dari selisih hari jatuh tempo vs hari ini (§25).
 * Fungsi murni — bisa diuji tanpa database.
 */
export function tentukanJenisPengingat(jatuhTempo: Date, hariIni: Date): JenisPengingat | null {
  const selisihHari = Math.round(
    (new Date(jatuhTempo).getTime() - new Date(hariIni).getTime()) / 86400000
  );
  if (selisihHari === 7) return "H-7";
  if (selisihHari === 1) return "H-1";
  if (selisihHari === 0) return "H-0";
  return null;
}

export type PengingatSiapKirim = {
  userId: string;
  invoiceId: string;
  jenis: JenisPengingat;
  judul: string;
  isi: string;
  refId: string;
};

/** Susun payload pengingat (murni, tanpa DB) dari daftar invoice BELUM_BAYAR. */
export function susunPengingat(
  invoices: { id: string; userId: string; periode: string; nominal: number; jatuhTempo: Date }[],
  hariIni: Date
): PengingatSiapKirim[] {
  const hasil: PengingatSiapKirim[] = [];
  for (const inv of invoices) {
    const jenis = tentukanJenisPengingat(inv.jatuhTempo, hariIni);
    if (!jenis) continue;
    hasil.push({
      userId: inv.userId,
      invoiceId: inv.id,
      jenis,
      judul: `Pengingat iuran ${labelPeriode(inv.periode)}`,
      isi: `${PESAN[jenis]} Nominal ${rupiah(inv.nominal)}.`,
      refId: `pengingat:${jenis}:${inv.id}`,
    });
  }
  return hasil;
}

export type HasilPengingat = { dikirim: number; dilewati: number };

/**
 * Kirim pengingat iuran untuk invoice BELUM_BAYAR milik siswa AKTIF yang punya
 * akun login, dengan jatuh tempo H-7 / H-1 / hari ini (§25).
 * Idempoten: pemanggilan ulang di hari yang sama menghasilkan 0 kiriman baru
 * (unique userId+tipe+refId; P2002 dihitung "dilewati").
 */
export async function kirimPengingatIuran(): Promise<HasilPengingat> {
  const hariIni = hariIniMakassar();
  const target = [0, 1, 7].map((n) => {
    const d = new Date(hariIni);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      status: "BELUM_BAYAR",
      jatuhTempo: { in: target },
      student: { status: "AKTIF", userId: { not: null }, user: { isActive: true } },
    },
    select: {
      id: true,
      periode: true,
      nominal: true,
      jatuhTempo: true,
      student: { select: { userId: true } },
    },
  });

  const siap = susunPengingat(
    invoices
      .filter((i) => i.student.userId)
      .map((i) => ({
        id: i.id,
        userId: i.student.userId as string,
        periode: i.periode,
        nominal: i.nominal,
        jatuhTempo: i.jatuhTempo,
      })),
    hariIni
  );

  let dikirim = 0;
  let dilewati = 0;
  for (const p of siap) {
    try {
      await prisma.notification.create({
        data: { userId: p.userId, judul: p.judul, isi: p.isi, tipe: "IURAN", refId: p.refId },
      });
      dikirim++;
    } catch (e) {
      // P2002 = pengingat jenis ini untuk invoice ini sudah dikirim hari ini.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        dilewati++;
        continue;
      }
      throw e;
    }
  }
  return { dikirim, dilewati };
}
