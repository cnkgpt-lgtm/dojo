import { prisma, Prisma } from "./db";
import type { PaymentMethod } from "@prisma/client";
import { filterTanggalKalender, saldoDariTotal } from "./keuangan";
import { statusTampilan } from "./iuran";

export type FilterLaporanKeuangan = {
  dari?: string;
  sampai?: string;
  dojoId?: string | null;
  kategoriId?: string;
  metode?: string;
};

/**
 * Agregasi laporan keuangan (§30, §66). Dipakai API GET /api/laporan/keuangan
 * dan halaman /dashboard/laporan.
 */
export async function laporanKeuangan(f: FilterLaporanKeuangan) {
  const filterTanggal = filterTanggalKalender(f.dari, f.sampai);
  // Filter metode hanya berlaku untuk pemasukan (model Expense tak punya metode, §28).
  const metodeValid: PaymentMethod | undefined =
    f.metode === "TUNAI" || f.metode === "TRANSFER" ? f.metode : undefined;
  const scope = f.dojoId ? { dojoId: f.dojoId } : {};

  const whereMasuk: Prisma.RevenueWhereInput = {
    ...scope,
    ...(metodeValid ? { metode: metodeValid } : {}),
  };
  const whereKeluar: Prisma.ExpenseWhereInput = { ...scope };
  if (f.kategoriId) {
    whereMasuk.kategoriId = f.kategoriId;
    whereKeluar.kategoriId = f.kategoriId;
  }
  if (Object.keys(filterTanggal).length > 0) {
    whereMasuk.tanggal = filterTanggal;
    whereKeluar.tanggal = filterTanggal;
  }

  const [
    aggMasuk,
    aggKeluar,
    perKategoriMasuk,
    perKategoriKeluar,
    tunaiMasuk,
    transferMasuk,
    perDojo,
    transaksiMasuk,
    transaksiKeluar,
    katMasuk,
    katKeluar,
    daftarDojo,
  ] = await Promise.all([
    prisma.revenue.aggregate({ where: whereMasuk, _sum: { nominal: true } }),
    prisma.expense.aggregate({ where: whereKeluar, _sum: { nominal: true } }),
    prisma.revenue.groupBy({ by: ["kategoriId"], where: whereMasuk, _sum: { nominal: true }, _count: true }),
    prisma.expense.groupBy({ by: ["kategoriId"], where: whereKeluar, _sum: { nominal: true }, _count: true }),
    prisma.revenue.aggregate({ where: { ...whereMasuk, metode: "TUNAI" }, _sum: { nominal: true } }),
    prisma.revenue.aggregate({ where: { ...whereMasuk, metode: "TRANSFER" }, _sum: { nominal: true } }),
    prisma.revenue.groupBy({ by: ["dojoId"], where: whereMasuk, _sum: { nominal: true }, _count: true }),
    prisma.revenue.findMany({
      where: whereMasuk,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: { kategori: { select: { nama: true } }, dojo: { select: { nama: true } } },
    }),
    prisma.expense.findMany({
      where: whereKeluar,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: { kategori: { select: { nama: true } }, dojo: { select: { nama: true } } },
    }),
    prisma.revenueCategory.findMany({ select: { id: true, nama: true } }),
    prisma.expenseCategory.findMany({ select: { id: true, nama: true } }),
    prisma.dojo.findMany({ select: { id: true, nama: true } }),
  ]);

  const namaKatMasuk = new Map(katMasuk.map((k) => [k.id, k.nama]));
  const namaKatKeluar = new Map(katKeluar.map((k) => [k.id, k.nama]));
  const namaDojo = new Map(daftarDojo.map((d) => [d.id, d.nama]));

  const totalPemasukan = aggMasuk._sum.nominal ?? 0;
  const totalPengeluaran = aggKeluar._sum.nominal ?? 0;

  const daftarTransaksi = [
    ...transaksiMasuk.map((t) => ({
      id: t.id,
      jenis: "masuk" as const,
      tanggal: t.tanggal,
      kategori: t.kategori.nama,
      deskripsi: t.deskripsi,
      nominal: t.nominal,
      metode: t.metode,
      dojo: t.dojo.nama,
      otomatis: !!t.paymentId,
    })),
    ...transaksiKeluar.map((t) => ({
      id: t.id,
      jenis: "keluar" as const,
      tanggal: t.tanggal,
      kategori: t.kategori.nama,
      deskripsi: t.deskripsi,
      nominal: t.nominal,
      metode: null as string | null,
      dojo: t.dojo.nama,
      otomatis: false,
    })),
  ]
    .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
    .slice(0, 300);

  return {
    totalPemasukan,
    totalPengeluaran,
    saldo: saldoDariTotal(totalPemasukan, totalPengeluaran),
    perKategoriMasuk: perKategoriMasuk.map((g) => ({
      kategori: namaKatMasuk.get(g.kategoriId) ?? "-",
      total: g._sum.nominal ?? 0,
      jumlah: g._count,
    })),
    perKategoriKeluar: perKategoriKeluar.map((g) => ({
      kategori: namaKatKeluar.get(g.kategoriId) ?? "-",
      total: g._sum.nominal ?? 0,
      jumlah: g._count,
    })),
    tunaiVsTransfer: {
      pemasukanTunai: tunaiMasuk._sum.nominal ?? 0,
      pemasukanTransfer: transferMasuk._sum.nominal ?? 0,
    },
    pendapatanPerDojo: perDojo.map((g) => ({
      dojo: namaDojo.get(g.dojoId) ?? "-",
      total: g._sum.nominal ?? 0,
      jumlah: g._count,
    })),
    daftarTransaksi,
  };
}

const MAKS_BULAN_MATRIKS = 12;

/** Daftar periode YYYY-MM dari awal sampai akhir (inklusif), dibatasi 12 bulan. */
export function daftarPeriode(awal: string, akhir: string): string[] {
  const hasil: string[] = [];
  let [y, m] = awal.split("-").map(Number);
  const [y2, m2] = akhir.split("-").map(Number);
  while (hasil.length < MAKS_BULAN_MATRIKS && (y < y2 || (y === y2 && m <= m2))) {
    hasil.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return hasil;
}

export type FilterLaporanIuran = {
  periodeAwal?: string;
  periodeAkhir?: string;
  dojoId?: string | null;
  q?: string;
  status?: string;
};

const STATUS_IURAN_VALID = ["LUNAS", "BELUM_BAYAR", "MENUNGGU_VERIFIKASI", "DITOLAK", "TERLAMBAT"];

/**
 * Matriks siswa × bulan untuk laporan iuran (§31).
 * Sel bernilai "-", atau status tampilan (LUNAS/BELUM_BAYAR/MENUNGGU_VERIFIKASI/DITOLAK/TERLAMBAT).
 */
export async function laporanIuran(f: FilterLaporanIuran) {
  const periodeRe = /^\d{4}-(0[1-9]|1[0-2])$/;
  const sekarang = new Date();
  const bulanIni = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
  const periodeAkhir = f.periodeAkhir && periodeRe.test(f.periodeAkhir) ? f.periodeAkhir : bulanIni;
  let periodeAwal = f.periodeAwal ?? "";
  if (!periodeRe.test(periodeAwal) || periodeAwal > periodeAkhir) {
    const [y, m] = periodeAkhir.split("-").map(Number);
    const d = new Date(y, m - 1 - 3, 1);
    periodeAwal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const periodes = daftarPeriode(periodeAwal, periodeAkhir);
  const q = f.q?.trim() ?? "";

  const whereSiswa: Prisma.StudentWhereInput = {};
  if (f.dojoId) whereSiswa.dojoId = f.dojoId;
  if (q) {
    whereSiswa.OR = [
      { nama: { contains: q, mode: "insensitive" } },
      { memberId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [siswaList, invoices] = await Promise.all([
    prisma.student.findMany({
      where: whereSiswa,
      orderBy: { nama: "asc" },
      take: 500,
      select: { id: true, nama: true, memberId: true, dojo: { select: { nama: true } } },
    }),
    prisma.invoice.findMany({
      where: {
        periode: { gte: periodes[0], lte: periodes[periodes.length - 1] },
        ...(f.dojoId ? { dojoId: f.dojoId } : {}),
        ...(q
          ? {
              student: {
                OR: [
                  { nama: { contains: q, mode: "insensitive" } },
                  { memberId: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      select: { studentId: true, periode: true, status: true, jatuhTempo: true },
    }),
  ]);

  const peta = new Map<string, string>();
  for (const inv of invoices) {
    peta.set(`${inv.studentId}|${inv.periode}`, statusTampilan(inv));
  }

  let baris = siswaList.map((s) => ({
    id: s.id,
    nama: s.nama,
    memberId: s.memberId,
    dojo: s.dojo.nama,
    sel: periodes.map((p) => peta.get(`${s.id}|${p}`) ?? "-"),
  }));

  if (f.status && STATUS_IURAN_VALID.includes(f.status)) {
    baris = baris.filter((b) => b.sel.includes(f.status!));
  }

  return { periodes, baris, jumlahSiswa: baris.length };
}
