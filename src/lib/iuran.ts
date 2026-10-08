import { prisma, Prisma } from "./db";
import type { FeeSetting, Invoice, InvoiceStatus } from "@prisma/client";

/**
 * Logika bisnis iuran Phase 4 (§18–§24).
 * Zona waktu: Asia/Makassar (WITA), mengikuti konvensi proyek.
 */

const ZONA = "Asia/Makassar";

/** Periode "YYYY-MM" menurut kalender Makassar. */
export function periodeBerjalan(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: ZONA,
  });
  const [thn, bln] = fmt.format(new Date()).split("-");
  return `${thn}-${bln}`;
}

/** Tanggal jatuh tempo untuk periode + hari (1–28): disimpan sebagai @db.Date (UTC 00:00). */
export function jatuhTempoUntuk(periode: string, hari: number): Date {
  const [thn, bln] = periode.split("-").map(Number);
  return new Date(Date.UTC(thn, bln - 1, Math.min(28, Math.max(1, hari))));
}

/** Hari ini (tanggal saja) menurut zona Makassar, sebagai UTC 00:00 agar sebanding dengan @db.Date. */
export function hariIniMakassar(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONA,
  });
  const [thn, bln, tgl] = fmt.format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(thn, bln - 1, tgl));
}

/** true bila tanggal jatuh tempo sudah lewat hari ini (Makassar). */
export function sudahLewatJatuhTempo(jatuhTempo: Date): boolean {
  return hariIniMakassar().getTime() > new Date(jatuhTempo).getTime();
}

/**
 * Resolusi tarif per siswa (§18): tarif siswa-spesifik > tarif dojo > tarif default organisasi.
 * Hanya tarif aktif yang dipertimbangkan; yang terbaru menang bila ada beberapa.
 */
export async function tarifUntukSiswa(studentId: string): Promise<FeeSetting | null> {
  const siswa = await prisma.student.findUnique({
    where: { id: studentId },
    select: { dojoId: true },
  });
  if (!siswa) return null;

  const [khusus, dojo, umum] = await Promise.all([
    prisma.feeSetting.findFirst({
      where: { isActive: true, studentId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feeSetting.findFirst({
      where: { isActive: true, dojoId: siswa.dojoId, studentId: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feeSetting.findFirst({
      where: { isActive: true, dojoId: null, studentId: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return khusus ?? dojo ?? umum;
}

/**
 * Status tampilan tagihan (§20): TERLAMBAT dihitung dinamis saat baca
 * (BELUM_BAYAR + lewat jatuh tempo), tanpa mengandalkan cron (§67).
 */
export function statusTampilan(invoice: { status: InvoiceStatus; jatuhTempo: Date }): InvoiceStatus {
  if (invoice.status === "BELUM_BAYAR" && sudahLewatJatuhTempo(invoice.jatuhTempo)) {
    return "TERLAMBAT";
  }
  return invoice.status;
}

/** Sisa yang harus dibayar: nominal dikurangi pembayaran LUNAS yang sudah tercatat. */
export async function sisaTagihan(invoiceId: string): Promise<{ nominal: number; terbayar: number; sisa: number } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { nominal: true },
  });
  if (!invoice) return null;
  const agg = await prisma.payment.aggregate({
    where: { invoiceId, status: "LUNAS" },
    _sum: { nominal: true },
  });
  const terbayar = agg._sum.nominal ?? 0;
  return { nominal: invoice.nominal, terbayar, sisa: invoice.nominal - terbayar };
}

/** Pastikan kategori pemasukan "Iuran Bulanan" ada (§27); kembalikan id-nya. */
export async function pastikanKategoriIuran(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx ?? prisma;
  const ada = await db.revenueCategory.findFirst({ where: { nama: "Iuran Bulanan" } });
  if (ada) return ada.id;
  try {
    const buat = await db.revenueCategory.create({ data: { nama: "Iuran Bulanan" } });
    return buat.id;
  } catch {
    // Balapan dengan request lain: baca ulang.
    const lagi = await db.revenueCategory.findFirst({ where: { nama: "Iuran Bulanan" } });
    if (lagi) return lagi.id;
    throw new Error("Gagal menyiapkan kategori Iuran Bulanan.");
  }
}

/** Label periode "2026-11" menjadi "November 2026" (id-ID). */
export function labelPeriode(periode: string): string {
  const [thn, bln] = periode.split("-").map(Number);
  if (!thn || !bln) return periode;
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(thn, bln - 1, 1))
  );
}

export type HasilGenerate = {
  dibuat: number;
  sudahAda: number;
  tanpaTarif: number;
};

/**
 * Buat tagihan bulanan untuk semua siswa AKTIF pada dojo-dojo tertentu (§19).
 * IDEMPOTEN: unique(studentId, periode) — P2002 dihitung sebagai "sudahAda".
 * Juga dipakai oleh endpoint cron (§67).
 */
export async function buatTagihanPeriode(
  periode: string,
  dojoIds: string[],
  kirimNotif: (userId: string | null, periode: string, nominal: number) => Promise<void>
): Promise<HasilGenerate> {
  const hasil: HasilGenerate = { dibuat: 0, sudahAda: 0, tanpaTarif: 0 };

  const siswaAktif = await prisma.student.findMany({
    where: { status: "AKTIF", dojoId: { in: dojoIds } },
    select: { id: true, dojoId: true, userId: true },
  });

  for (const s of siswaAktif) {
    const tarif = await tarifUntukSiswa(s.id);
    if (!tarif) {
      hasil.tanpaTarif++;
      continue;
    }
    try {
      await prisma.invoice.create({
        data: {
          studentId: s.id,
          dojoId: s.dojoId,
          feeSettingId: tarif.id,
          periode,
          nominal: tarif.nominal,
          jatuhTempo: jatuhTempoUntuk(periode, tarif.hariJatuhTempo),
          status: "BELUM_BAYAR",
        },
      });
      hasil.dibuat++;
      await kirimNotif(s.userId, periode, tarif.nominal);
    } catch (e) {
      // P2002 = tagihan periode ini sudah ada (idempoten, §49).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        hasil.sudahAda++;
        continue;
      }
      throw e;
    }
  }
  return hasil;
}
