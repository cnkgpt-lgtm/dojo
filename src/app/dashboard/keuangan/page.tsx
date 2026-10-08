import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole, filterScopeDojo } from "@/lib/authz";
import { rupiah, formatTanggal } from "@/lib/format";
import { hitungSaldo } from "@/lib/keuangan";

function StatCard({ label, nilai, catatan, sorot }: { label: string; nilai: string; catatan?: string; sorot?: boolean }) {
  return (
    <div className={`brutal-card p-5 ${sorot ? "bg-dojo-700 text-white" : "bg-slate-50"}`}>
      <p className={`text-xs font-black uppercase tracking-wide ${sorot ? "text-white/80" : "text-slate-500"}`}>{label}</p>
      <p className="brutal-angka mt-2 text-2xl">{nilai}</p>
      {catatan && <p className={`mt-1 text-xs ${sorot ? "text-white/80" : "text-slate-500"}`}>{catatan}</p>}
    </div>
  );
}

export default async function KeuanganPage() {
  const u = await wajibRole("ADMIN");
  const scope = filterScopeDojo(u);

  const [keuangan, dojos, transaksiTerbaru] = await Promise.all([
    hitungSaldo(u.scopeDojoId),
    u.scopeDojoId
      ? []
      : prisma.dojo.findMany({ where: { isActive: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    prisma.revenue.findMany({
      where: scope,
      orderBy: [{ tanggal: "desc" }],
      take: 5,
      include: { kategori: { select: { nama: true } }, dojo: { select: { nama: true } } },
    }),
  ]);

  const saldoPerDojo = u.scopeDojoId
    ? []
    : await Promise.all(
        dojos.map(async (d) => ({ dojo: d, ...(await hitungSaldo(d.id)) }))
      );

  return (
    <div className="anim-fade-up space-y-6">
      <div>
        <h1 className="brutal-title text-2xl">KEUANGAN</h1>
        <p className="mt-1 text-sm text-slate-500">
          {u.scopeDojoId ? "Kas dojo Anda." : "Kas seluruh organisasi per dojo."}
        </p>
      </div>

      <section aria-label="Ringkasan kas" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Total Pemasukan" nilai={rupiah(keuangan.totalPemasukan)} />
        <StatCard label="Total Pengeluaran" nilai={rupiah(keuangan.totalPengeluaran)} />
        <StatCard label="Saldo Kas" nilai={rupiah(keuangan.saldo)} catatan="Pemasukan dikurangi pengeluaran" sorot />
      </section>

      {saldoPerDojo.length > 0 && (
        <section aria-label="Saldo per dojo">
          <h2 className="brutal-title mb-3 text-lg">SALDO PER DOJO</h2>
          <div className="brutal-card overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-black">Dojo</th>
                  <th className="px-4 py-3 text-right font-black">Pemasukan</th>
                  <th className="px-4 py-3 text-right font-black">Pengeluaran</th>
                  <th className="px-4 py-3 text-right font-black">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {saldoPerDojo.map(({ dojo, totalPemasukan, totalPengeluaran, saldo }) => (
                  <tr key={dojo.id} className="border-t-2 border-black/10">
                    <td className="px-4 py-3 font-semibold">{dojo.nama}</td>
                    <td className="brutal-angka px-4 py-3 text-right text-emerald-700">{rupiah(totalPemasukan)}</td>
                    <td className="brutal-angka px-4 py-3 text-right text-red-700">{rupiah(totalPengeluaran)}</td>
                    <td className="brutal-angka px-4 py-3 text-right">{rupiah(saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-label="Menu keuangan" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/keuangan/pemasukan"
          className="brutal-card flex min-h-[72px] items-center justify-between bg-emerald-700 px-5 text-white"
        >
          <span>
            <span className="block text-base font-black uppercase tracking-wide">Pemasukan</span>
            <span className="block text-xs text-emerald-100">Catat & kelola pemasukan dojo</span>
          </span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </Link>
        <Link
          href="/dashboard/keuangan/pengeluaran"
          className="brutal-card flex min-h-[72px] items-center justify-between bg-amber-600 px-5 text-white"
        >
          <span>
            <span className="block text-base font-black uppercase tracking-wide">Pengeluaran</span>
            <span className="block text-xs text-amber-100">Catat & kelola pengeluaran dojo</span>
          </span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </Link>
      </section>

      {transaksiTerbaru.length > 0 && (
        <section aria-label="Pemasukan terbaru">
          <h2 className="brutal-title mb-3 text-lg">PEMASUKAN TERBARU</h2>
          <ul className="space-y-2">
            {transaksiTerbaru.map((t) => (
              <li key={t.id} className="brutal-card flex items-center justify-between gap-3 bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.deskripsi}</p>
                  <p className="text-xs text-slate-500">
                    {formatTanggal(t.tanggal)} · {t.kategori.nama} · {t.dojo.nama}
                    {t.paymentId ? " · Otomatis (Iuran)" : ""}
                  </p>
                </div>
                <p className="brutal-angka shrink-0 text-sm text-emerald-700">+{rupiah(t.nominal)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
