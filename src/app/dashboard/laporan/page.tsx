import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { rupiah, formatTanggal, LABEL_METODE_BAYAR } from "@/lib/format";
import { laporanKeuangan } from "@/lib/laporan";
import { CetakButton } from "@/components/CetakButton";

const inputCls = "brutal-input";

function Kartu({ label, nilai, sub }: { label: string; nilai: string; sub?: string }) {
  return (
    <div className="print-block brutal-card bg-slate-50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="brutal-angka mt-2 text-2xl">{nilai}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await wajibRole("ADMIN");
  const sp = await searchParams;
  const dari = sp.dari ?? "";
  const sampai = sp.sampai ?? "";
  const dojoFilter = sp.dojo ?? "";
  const kategori = sp.kategori ?? "";
  const metode = sp.metode ?? "";

  const [hasil, dojoList, katMasuk, katKeluar] = await Promise.all([
    laporanKeuangan({
      dari: dari || undefined,
      sampai: sampai || undefined,
      dojoId: u.scopeDojoId ?? dojoFilter ?? undefined,
      kategoriId: kategori || undefined,
      metode: metode || undefined,
    }),
    u.scopeDojoId
      ? []
      : prisma.dojo.findMany({ where: { isActive: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    prisma.revenueCategory.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    prisma.expenseCategory.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);
  const semuaKategori = [
    ...katMasuk.map((k) => ({ ...k, tipe: "Pemasukan" })),
    ...katKeluar.map((k) => ({ ...k, tipe: "Pengeluaran" })),
  ];

  return (
    <div className="anim-fade-up space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brutal-title text-2xl">LAPORAN KEUANGAN</h1>
          <p className="mt-1 text-sm text-slate-500">Filter periode, dojo, kategori, dan metode pembayaran.</p>
        </div>
        <CetakButton />
      </div>
      <div className="hidden print:block">
        <h1 className="text-xl font-extrabold">Laporan Keuangan DojoKu</h1>
        <p className="text-sm text-slate-500">
          Periode: {dari || "awal"} s/d {sampai || "sekarang"}
          {dojoFilter ? ` · Dojo: ${dojoList.find((d) => d.id === dojoFilter)?.nama ?? ""}` : ""}
        </p>
      </div>

      {/* Filter */}
      <form method="get" className="no-print brutal-card grid grid-cols-2 gap-3 bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block text-xs font-semibold">Dari
          <input type="date" name="dari" defaultValue={dari} className={inputCls} />
        </label>
        <label className="block text-xs font-semibold">Sampai
          <input type="date" name="sampai" defaultValue={sampai} className={inputCls} />
        </label>
        {!u.scopeDojoId && (
          <label className="block text-xs font-semibold">Dojo
            <select name="dojo" defaultValue={dojoFilter} className={inputCls}>
              <option value="">Semua</option>
              {dojoList.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-xs font-semibold">Kategori
          <select name="kategori" defaultValue={kategori} className={inputCls}>
            <option value="">Semua</option>
            {semuaKategori.map((k) => (
              <option key={k.id} value={k.id}>{k.nama} ({k.tipe})</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold">Metode (pemasukan)
          <select name="metode" defaultValue={metode} className={inputCls}>
            <option value="">Semua</option>
            <option value="TUNAI">Tunai</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-1">
          <button type="submit" className="brutal-btn brutal-btn-dark w-full">
            Tampilkan
          </button>
        </div>
      </form>

      {/* Ringkasan */}
      <section aria-label="Ringkasan" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Kartu label="Total Pemasukan" nilai={rupiah(hasil.totalPemasukan)} />
        <Kartu label="Total Pengeluaran" nilai={rupiah(hasil.totalPengeluaran)} />
        <Kartu label="Saldo" nilai={rupiah(hasil.saldo)} sub="Pemasukan dikurangi pengeluaran" />
      </section>

      {/* Tunai vs transfer (pemasukan, §30) */}
      <section aria-label="Tunai vs transfer" className="print-block brutal-card bg-slate-50 p-5">
        <h2 className="brutal-title mb-3 text-lg">PEMASUKAN: TUNAI VS TRANSFER</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Tunai</dt><dd className="brutal-angka font-bold">{rupiah(hasil.tunaiVsTransfer.pemasukanTunai)}</dd></div>
          <div><dt className="text-slate-500">Transfer</dt><dd className="brutal-angka font-bold">{rupiah(hasil.tunaiVsTransfer.pemasukanTransfer)}</dd></div>
        </dl>
      </section>

      {/* Per kategori */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Pemasukan per kategori" className="print-block">
          <h2 className="brutal-title mb-3 text-lg">PEMASUKAN PER KATEGORI</h2>
          {hasil.perKategoriMasuk.length === 0 ? (
            <p className="brutal-card bg-slate-50 p-5 text-sm text-slate-500">Tidak ada data.</p>
          ) : (
            <ul className="space-y-2">
              {hasil.perKategoriMasuk.map((k) => (
                <li key={k.kategori} className="brutal-card flex items-center justify-between bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold">{k.kategori} <span className="font-normal text-slate-500">({k.jumlah}x)</span></span>
                  <span className="brutal-angka text-emerald-700">{rupiah(k.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label="Pengeluaran per kategori" className="print-block">
          <h2 className="brutal-title mb-3 text-lg">PENGELUARAN PER KATEGORI</h2>
          {hasil.perKategoriKeluar.length === 0 ? (
            <p className="brutal-card bg-slate-50 p-5 text-sm text-slate-500">Tidak ada data.</p>
          ) : (
            <ul className="space-y-2">
              {hasil.perKategoriKeluar.map((k) => (
                <li key={k.kategori} className="brutal-card flex items-center justify-between bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold">{k.kategori} <span className="font-normal text-slate-500">({k.jumlah}x)</span></span>
                  <span className="brutal-angka text-red-700">{rupiah(k.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pendapatan per dojo */}
      {!u.scopeDojoId && hasil.pendapatanPerDojo.length > 0 && (
        <section aria-label="Pendapatan per dojo" className="print-block">
          <h2 className="brutal-title mb-3 text-lg">PENDAPATAN PER DOJO</h2>
          <ul className="space-y-2">
            {hasil.pendapatanPerDojo.map((d) => (
              <li key={d.dojo} className="brutal-card flex items-center justify-between bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold">{d.dojo} <span className="font-normal text-slate-500">({d.jumlah}x)</span></span>
                <span className="brutal-angka">{rupiah(d.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Daftar transaksi */}
      <section aria-label="Daftar transaksi">
        <h2 className="brutal-title mb-3 text-lg">DAFTAR TRANSAKSI</h2>
        {hasil.daftarTransaksi.length === 0 ? (
          <p className="brutal-card p-6 text-center text-sm text-slate-500">
            Tidak ada transaksi pada filter ini.
          </p>
        ) : (
          <div className="brutal-card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-black">Tanggal</th>
                  <th className="px-4 py-3 font-black">Keterangan</th>
                  <th className="px-4 py-3 font-black">Kategori</th>
                  <th className="px-4 py-3 font-black">Metode</th>
                  <th className="px-4 py-3 font-black">Dojo</th>
                  <th className="px-4 py-3 text-right font-black">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {hasil.daftarTransaksi.map((t) => (
                  <tr key={`${t.jenis}-${t.id}`} className="border-t-2 border-black/10">
                    <td className="whitespace-nowrap px-4 py-3">{formatTanggal(t.tanggal)}</td>
                    <td className="px-4 py-3 font-semibold">{t.deskripsi}</td>
                    <td className="px-4 py-3">{t.kategori}</td>
                    <td className="px-4 py-3">{t.metode ? LABEL_METODE_BAYAR[t.metode as keyof typeof LABEL_METODE_BAYAR] : "-"}</td>
                    <td className="px-4 py-3">{t.dojo}</td>
                    <td className={`brutal-angka px-4 py-3 text-right ${t.jenis === "masuk" ? "text-emerald-700" : "text-red-700"}`}>
                      {t.jenis === "masuk" ? "+" : "-"}{rupiah(t.nominal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="no-print">
        <Link href="/dashboard/laporan/iuran" className="brutal-btn brutal-btn-light text-dojo-700">
          Lihat Laporan Iuran →
        </Link>
      </div>
    </div>
  );
}
