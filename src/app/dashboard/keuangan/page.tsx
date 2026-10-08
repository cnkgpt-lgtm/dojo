import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole, filterScopeDojo } from "@/lib/authz";
import { rupiah, formatTanggal } from "@/lib/format";
import { hitungSaldo } from "@/lib/keuangan";

function StatCard({ label, nilai, catatan, sorot }: { label: string; nilai: string; catatan?: string; sorot?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 ${sorot ? "bg-dojo-700 text-white ring-dojo-700" : "bg-slate-50 ring-slate-200"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${sorot ? "text-red-100" : "text-slate-500"}`}>{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{nilai}</p>
      {catatan && <p className={`mt-1 text-xs ${sorot ? "text-red-100" : "text-slate-500"}`}>{catatan}</p>}
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
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Keuangan</h1>
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
          <h2 className="mb-3 text-base font-bold">Saldo per Dojo</h2>
          <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Dojo</th>
                  <th className="px-4 py-3 text-right font-semibold">Pemasukan</th>
                  <th className="px-4 py-3 text-right font-semibold">Pengeluaran</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {saldoPerDojo.map(({ dojo, totalPemasukan, totalPengeluaran, saldo }) => (
                  <tr key={dojo.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{dojo.nama}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{rupiah(totalPemasukan)}</td>
                    <td className="px-4 py-3 text-right text-red-700">{rupiah(totalPengeluaran)}</td>
                    <td className="px-4 py-3 text-right font-bold">{rupiah(saldo)}</td>
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
          className="flex min-h-[72px] items-center justify-between rounded-2xl bg-emerald-700 px-5 text-white"
        >
          <span>
            <span className="block text-base font-extrabold">Pemasukan</span>
            <span className="block text-xs text-emerald-100">Catat & kelola pemasukan dojo</span>
          </span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </Link>
        <Link
          href="/dashboard/keuangan/pengeluaran"
          className="flex min-h-[72px] items-center justify-between rounded-2xl bg-amber-600 px-5 text-white"
        >
          <span>
            <span className="block text-base font-extrabold">Pengeluaran</span>
            <span className="block text-xs text-amber-100">Catat & kelola pengeluaran dojo</span>
          </span>
          <span aria-hidden="true" className="text-2xl">→</span>
        </Link>
      </section>

      {transaksiTerbaru.length > 0 && (
        <section aria-label="Pemasukan terbaru">
          <h2 className="mb-3 text-base font-bold">Pemasukan Terbaru</h2>
          <ul className="space-y-2">
            {transaksiTerbaru.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.deskripsi}</p>
                  <p className="text-xs text-slate-500">
                    {formatTanggal(t.tanggal)} · {t.kategori.nama} · {t.dojo.nama}
                    {t.paymentId ? " · Otomatis (Iuran)" : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-extrabold text-emerald-700">+{rupiah(t.nominal)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
