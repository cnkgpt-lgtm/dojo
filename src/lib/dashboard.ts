import { prisma } from "./db";
import { hitungSaldo, tanggalMakassar, rentangHariWita } from "./keuangan";

/**
 * Agregasi dashboard admin (§37). Satu panggilan untuk kartu-kartu dashboard
 * dan untuk API GET /api/dashboard/admin.
 * scopeDojoId null = admin pusat (seluruh organisasi); terisi = admin dojo.
 */
export async function ringkasanAdmin(scopeDojoId: string | null) {
  const scope = scopeDojoId ? { dojoId: scopeDojoId } : {};
  const hariIni = tanggalMakassar();
  const { mulai, selesai } = rentangHariWita(hariIni);
  // Kolom @db.Date: bandingkan sebagai tanggal kalender (pola sama seperti API absensi).
  const [y, m, d] = hariIni.split("-").map(Number);
  const tanggalKalender = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const [
    totalSiswa,
    totalDojo,
    totalSensei,
    kehadiranHariIni,
    pembayaranHariIni,
    menungguVerifikasi,
    tunggakan,
    keuangan,
  ] = await Promise.all([
    prisma.student.count({ where: { status: "AKTIF", ...scope } }),
    scopeDojoId
      ? prisma.dojo.count({ where: { id: scopeDojoId, isActive: true } })
      : prisma.dojo.count({ where: { isActive: true } }),
    prisma.coach.count({ where: { isActive: true, ...scope } }),
    prisma.attendance.count({
      where: { tanggal: tanggalKalender, ...scope },
    }),
    prisma.payment.aggregate({
      where: {
        status: "LUNAS",
        createdAt: { gte: mulai, lt: selesai },
        ...(scopeDojoId ? { invoice: { dojoId: scopeDojoId } } : {}),
      },
      _sum: { nominal: true },
      _count: true,
    }),
    prisma.payment.count({
      where: {
        status: "MENUNGGU_VERIFIKASI",
        ...(scopeDojoId ? { invoice: { dojoId: scopeDojoId } } : {}),
      },
    }),
    prisma.invoice.aggregate({
      where: { status: "BELUM_BAYAR", ...scope },
      _sum: { nominal: true },
      _count: true,
    }),
    hitungSaldo(scopeDojoId),
  ]);

  return {
    totalSiswa,
    totalDojo,
    totalSensei,
    kehadiranHariIni,
    pembayaranHariIni: {
      jumlah: pembayaranHariIni._count,
      nominal: pembayaranHariIni._sum.nominal ?? 0,
    },
    menungguVerifikasi,
    totalTunggakan: {
      jumlah: tunggakan._count,
      nominal: tunggakan._sum.nominal ?? 0,
    },
    totalPemasukan: keuangan.totalPemasukan,
    totalPengeluaran: keuangan.totalPengeluaran,
    saldo: keuangan.saldo,
    tanggal: hariIni,
  };
}
