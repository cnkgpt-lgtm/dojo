import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { laporanIuran } from "@/lib/laporan";
import { CetakButton } from "@/components/CetakButton";
import { LABEL_STATUS_IURAN } from "@/lib/format";

const inputCls =
  "block w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-dojo-700";

const WARNA_SEL: Record<string, string> = {
  LUNAS: "bg-emerald-50 text-emerald-700",
  BELUM_BAYAR: "bg-slate-100 text-slate-600",
  MENUNGGU_VERIFIKASI: "bg-amber-50 text-amber-700",
  DITOLAK: "bg-red-50 text-red-700",
  TERLAMBAT: "bg-orange-50 text-orange-700",
  "-": "text-slate-300",
};

function labelSel(s: string): string {
  if (s === "-") return "-";
  return LABEL_STATUS_IURAN[s] ?? s;
}

export default async function LaporanIuranPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await wajibRole("ADMIN");
  const sp = await searchParams;
  const periodeAwal = sp.periodeAwal ?? "";
  const periodeAkhir = sp.periodeAkhir ?? "";
  const dojoFilter = sp.dojo ?? "";
  const q = sp.q ?? "";
  const status = sp.status ?? "";

  const [hasil, dojoList] = await Promise.all([
    laporanIuran({
      periodeAwal: periodeAwal || undefined,
      periodeAkhir: periodeAkhir || undefined,
      dojoId: u.scopeDojoId ?? dojoFilter ?? undefined,
      q: q || undefined,
      status: status || undefined,
    }),
    u.scopeDojoId
      ? []
      : prisma.dojo.findMany({ where: { isActive: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);

  return (
    <div className="anim-fade-up space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Laporan Iuran</h1>
          <p className="mt-1 text-sm text-slate-500">
            Status pembayaran per siswa per bulan ({hasil.jumlahSiswa} siswa).
          </p>
        </div>
        <CetakButton />
      </div>
      <div className="hidden print:block">
        <h1 className="text-xl font-extrabold">Laporan Iuran DojoKu</h1>
        <p className="text-sm text-slate-500">Periode: {hasil.periodes[0]} s/d {hasil.periodes[hasil.periodes.length - 1]}</p>
      </div>

      {/* Filter */}
      <form method="get" className="no-print grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block text-xs font-semibold">Dari bulan
          <input type="month" name="periodeAwal" defaultValue={periodeAwal} className={inputCls} />
        </label>
        <label className="block text-xs font-semibold">Sampai bulan
          <input type="month" name="periodeAkhir" defaultValue={periodeAkhir} className={inputCls} />
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
        <label className="block text-xs font-semibold">Status
          <select name="status" defaultValue={status} className={inputCls}>
            <option value="">Semua</option>
            {Object.entries(LABEL_STATUS_IURAN).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold">Cari siswa
          <input type="search" name="q" defaultValue={q} placeholder="Nama / Member ID" className={inputCls} />
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-1">
          <button type="submit" className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">
            Tampilkan
          </button>
        </div>
      </form>

      {/* Legenda */}
      <div className="no-print flex flex-wrap gap-2 text-xs">
        {Object.entries(WARNA_SEL).filter(([k]) => k !== "-").map(([k, cls]) => (
          <span key={k} className={`rounded-full px-2.5 py-1 font-semibold ${cls}`}>{labelSel(k)}</span>
        ))}
      </div>

      {/* Matriks */}
      {hasil.baris.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Tidak ada siswa pada filter ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Siswa</th>
                {hasil.periodes.map((p) => (
                  <th key={p} className="px-3 py-3 text-center font-semibold">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasil.baris.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{b.nama}</p>
                    <p className="text-xs text-slate-500">{b.memberId} · {b.dojo}</p>
                  </td>
                  {b.sel.map((s, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      <span className={`inline-block min-w-16 rounded-lg px-2 py-1 text-xs font-bold ${WARNA_SEL[s] ?? ""}`}>
                        {labelSel(s)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
