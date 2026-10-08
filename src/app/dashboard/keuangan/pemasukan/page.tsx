import Link from "next/link";
import { prisma, Prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { rupiah, formatTanggal, LABEL_METODE_BAYAR } from "@/lib/format";
import { filterTanggalKalender } from "@/lib/keuangan";
import { HapusButton } from "@/components/HapusButton";
import { Pagination } from "@/components/Pagination";

const PER_HALAMAN = 20;
const inputCls = "brutal-input";

export default async function PemasukanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await wajibRole("ADMIN");
  const sp = await searchParams;
  const halaman = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const dari = sp.dari ?? "";
  const sampai = sp.sampai ?? "";
  const kategori = sp.kategori ?? "";
  const metode = sp.metode ?? "";
  const dojoFilter = sp.dojo ?? "";
  const q = sp.q ?? "";

  const filterTanggal = filterTanggalKalender(dari || undefined, sampai || undefined);
  const where: Prisma.RevenueWhereInput = {};
  if (u.scopeDojoId) {
    where.dojoId = u.scopeDojoId;
  } else if (dojoFilter) {
    where.dojoId = dojoFilter;
  }
  if (kategori) where.kategoriId = kategori;
  if (metode === "TUNAI" || metode === "TRANSFER") where.metode = metode;
  if (Object.keys(filterTanggal).length > 0) where.tanggal = filterTanggal;
  if (q) where.deskripsi = { contains: q, mode: "insensitive" };

  const [data, total, kategoriList, dojoList, totalNominal] = await Promise.all([
    prisma.revenue.findMany({
      where,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        kategori: { select: { nama: true } },
        dojo: { select: { id: true, nama: true } },
        petugas: { select: { name: true } },
      },
    }),
    prisma.revenue.count({ where }),
    prisma.revenueCategory.findMany({ where: { isActive: true }, orderBy: { nama: "asc" } }),
    u.scopeDojoId
      ? []
      : prisma.dojo.findMany({ where: { isActive: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
    prisma.revenue.aggregate({ where, _sum: { nominal: true } }),
  ]);
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const buatHref = (p: number) => {
    const params = new URLSearchParams();
    if (dari) params.set("dari", dari);
    if (sampai) params.set("sampai", sampai);
    if (kategori) params.set("kategori", kategori);
    if (metode) params.set("metode", metode);
    if (dojoFilter) params.set("dojo", dojoFilter);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/dashboard/keuangan/pemasukan?${params.toString()}`;
  };

  return (
    <div className="anim-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brutal-title text-2xl">PEMASUKAN</h1>
          <p className="mt-1 text-sm text-slate-500">
            Total periode ini: <span className="brutal-angka font-extrabold text-emerald-700">{rupiah(totalNominal._sum.nominal ?? 0)}</span>
          </p>
        </div>
        <Link
          href="/dashboard/keuangan/pemasukan/tambah"
          className="brutal-btn brutal-btn-primary"
        >
          + Catat Pemasukan
        </Link>
      </div>

      {/* Filter */}
      <form method="get" className="brutal-card grid grid-cols-2 gap-3 bg-slate-50 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block text-xs font-semibold">Dari
          <input type="date" name="dari" defaultValue={dari} className={inputCls} />
        </label>
        <label className="block text-xs font-semibold">Sampai
          <input type="date" name="sampai" defaultValue={sampai} className={inputCls} />
        </label>
        <label className="block text-xs font-semibold">Kategori
          <select name="kategori" defaultValue={kategori} className={inputCls}>
            <option value="">Semua</option>
            {kategoriList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold">Metode
          <select name="metode" defaultValue={metode} className={inputCls}>
            <option value="">Semua</option>
            <option value="TUNAI">Tunai</option>
            <option value="TRANSFER">Transfer</option>
          </select>
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
        <label className="block text-xs font-semibold">Cari
          <input type="search" name="q" defaultValue={q} placeholder="Deskripsi" className={inputCls} />
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
          <button type="submit" className="brutal-btn brutal-btn-dark">
            Tampilkan
          </button>
          <Link href="/dashboard/keuangan/pemasukan" className="brutal-btn brutal-btn-light">
            Atur ulang
          </Link>
        </div>
      </form>

      {/* Daftar — kartu di mobile, tabel di desktop */}
      {data.length === 0 ? (
        <p className="brutal-card p-6 text-center text-sm text-slate-500">
          Belum ada pemasukan pada filter ini.
        </p>
      ) : (
        <>
          <ul className="space-y-2 lg:hidden">
            {data.map((t) => (
              <li key={t.id} className="brutal-card bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.deskripsi}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatTanggal(t.tanggal)} · {t.kategori.nama} · {LABEL_METODE_BAYAR[t.metode]}
                    </p>
                    <p className="text-xs text-slate-500">{t.dojo.nama}{t.paymentId ? " · Otomatis (Iuran)" : ""}</p>
                  </div>
                  <p className="brutal-angka shrink-0 text-sm text-emerald-700">+{rupiah(t.nominal)}</p>
                </div>
                {!t.paymentId && (
                  <div className="mt-3 flex gap-2">
                    <Link href={`/dashboard/keuangan/pemasukan/ubah/${t.id}`} className="brutal-btn brutal-btn-light">
                      Ubah
                    </Link>
                    <HapusButton nama="pemasukan ini" endpoint={`/api/pemasukan/${t.id}`} kembaliKe="/dashboard/keuangan/pemasukan" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="brutal-card hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-black">Tanggal</th>
                  <th className="px-4 py-3 font-black">Deskripsi</th>
                  <th className="px-4 py-3 font-black">Kategori</th>
                  <th className="px-4 py-3 font-black">Metode</th>
                  <th className="px-4 py-3 font-black">Dojo</th>
                  <th className="px-4 py-3 text-right font-black">Nominal</th>
                  <th className="px-4 py-3 text-right font-black">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.id} className="border-t-2 border-black/10">
                    <td className="whitespace-nowrap px-4 py-3">{formatTanggal(t.tanggal)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{t.deskripsi}</span>
                      {t.paymentId && (
                        <span className="brutal-badge ml-2 bg-sky-50 text-sky-700">
                          Otomatis (Iuran)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{t.kategori.nama}</td>
                    <td className="px-4 py-3">{LABEL_METODE_BAYAR[t.metode]}</td>
                    <td className="px-4 py-3">{t.dojo.nama}</td>
                    <td className="brutal-angka px-4 py-3 text-right text-emerald-700">+{rupiah(t.nominal)}</td>
                    <td className="px-4 py-3 text-right">
                      {t.paymentId ? (
                        <span className="text-xs text-slate-400">Terkunci</span>
                      ) : (
                        <span className="inline-flex gap-2">
                          <Link href={`/dashboard/keuangan/pemasukan/ubah/${t.id}`} className="font-semibold text-dojo-700 hover:underline">
                            Ubah
                          </Link>
                          <HapusButton nama="pemasukan ini" endpoint={`/api/pemasukan/${t.id}`} kembaliKe="/dashboard/keuangan/pemasukan" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination halaman={halaman} totalHalaman={totalHalaman} buatHref={buatHref} />
        </>
      )}
    </div>
  );
}
