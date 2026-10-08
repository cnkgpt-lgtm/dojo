import { prisma } from "./db";

/**
 * Agregasi keuangan DojoKu (§26–§29).
 * Saldo = total pemasukan − total pengeluaran (§29, acceptance §68).
 */

export const ZONA_WITA = "Asia/Makassar";

/** Fungsi murni: saldo dari dua total. Dipakai uji acceptance §68 (10jt − 4jt = 6jt). */
export function saldoDariTotal(totalPemasukan: number, totalPengeluaran: number): number {
  return totalPemasukan - totalPengeluaran;
}

/** Tanggal hari ini (YYYY-MM-DD) menurut zona Asia/Makassar. */
export function tanggalMakassar(sekarang: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WITA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sekarang);
}

/**
 * Rentang satu hari kalender WITA sebagai dua instant UTC.
 * Asia/Makassar = UTC+8 tetap (tanpa DST).
 */
export function rentangHariWita(tanggal: string): { mulai: Date; selesai: Date } {
  const mulai = new Date(`${tanggal}T00:00:00+08:00`);
  if (Number.isNaN(mulai.getTime())) throw new Error("Format tanggal tidak valid (YYYY-MM-DD).");
  return { mulai, selesai: new Date(mulai.getTime() + 24 * 3600 * 1000) };
}

/** Filter tanggal untuk kolom @db.Date (perbandingan tanggal kalender). */
export function filterTanggalKalender(dari?: string, sampai?: string): { gte?: Date; lte?: Date } {
  const f: { gte?: Date; lte?: Date } = {};
  if (dari && /^\d{4}-\d{2}-\d{2}$/.test(dari)) f.gte = new Date(dari);
  if (sampai && /^\d{4}-\d{2}-\d{2}$/.test(sampai)) f.lte = new Date(sampai);
  return f;
}

/**
 * Hitung saldo kas: total pemasukan − total pengeluaran (§29).
 * dojoId null = seluruh organisasi (admin pusat); terisi = satu dojo.
 * Pemasukan otomatis dari iuran (paymentId terisi) ikut dihitung SEKALI —
 * tidak ada duplikasi karena satu Payment hanya membentuk satu Revenue (§49).
 */
export async function hitungSaldo(dojoId?: string | null): Promise<{
  totalPemasukan: number;
  totalPengeluaran: number;
  saldo: number;
}> {
  const where = dojoId ? { dojoId } : {};
  const [masuk, keluar] = await Promise.all([
    prisma.revenue.aggregate({ where, _sum: { nominal: true } }),
    prisma.expense.aggregate({ where, _sum: { nominal: true } }),
  ]);
  const totalPemasukan = masuk._sum.nominal ?? 0;
  const totalPengeluaran = keluar._sum.nominal ?? 0;
  return { totalPemasukan, totalPengeluaran, saldo: saldoDariTotal(totalPemasukan, totalPengeluaran) };
}
