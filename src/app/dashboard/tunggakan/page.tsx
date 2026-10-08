import { prisma, Prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { BadgeIuran } from "@/components/BadgeIuran";
import { rupiah, formatTanggal} from "@/lib/format";
import { labelPeriode, statusTampilan } from "@/lib/iuran";

/** GET /dashboard/tunggakan — rekap tunggakan per siswa (admin, §24). */
export default async function TunggakanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await wajibRole("ADMIN");
  const sp = await searchParams;
  const dojoFilter = sp.dojo ?? "";

  const where: Prisma.InvoiceWhereInput = { status: "BELUM_BAYAR" };
  if (u.scopeDojoId) where.dojoId = u.scopeDojoId;
  else if (dojoFilter) where.dojoId = dojoFilter;

  const [invoices, dojoList] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: [{ jatuhTempo: "asc" }],
      include: {
        student: {
          select: { id: true, nama: true, memberId: true, dojo: { select: { nama: true } } },
        },
      },
    }),
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ]);

  const perSiswa = new Map<
    string,
    {
      nama: string;
      memberId: string;
      dojo: string;
      items: { id: string; periode: string; nominal: number; jatuhTempo: Date; tampil: string }[];
      total: number;
    }
  >();
  for (const inv of invoices) {
    const tampil = statusTampilan(inv);
    if (tampil !== "BELUM_BAYAR" && tampil !== "TERLAMBAT") continue;
    let g = perSiswa.get(inv.student.id);
    if (!g) {
      g = {
        nama: inv.student.nama,
        memberId: inv.student.memberId,
        dojo: inv.student.dojo.nama,
        items: [],
        total: 0,
      };
      perSiswa.set(inv.student.id, g);
    }
    g.items.push({
      id: inv.id,
      periode: inv.periode,
      nominal: inv.nominal,
      jatuhTempo: inv.jatuhTempo,
      tampil,
    });
    g.total += inv.nominal;
  }
  const data = [...perSiswa.values()].sort((a, b) => b.total - a.total);
  const grandTotal = data.reduce((s, g) => s + g.total, 0);

  return (
    <div className="anim-fade-up mx-auto max-w-6xl">
      <h1 className="brutal-title text-2xl">TUNGGAKAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {data.length} siswa menunggak · total{" "}
        <span className="brutal-angka font-extrabold text-slate-900">{rupiah(grandTotal)}</span>
      </p>

      {dojoList.length > 1 && (
        <form method="get" className="mb-4 flex gap-3">
          <select name="dojo" defaultValue={dojoFilter} className="brutal-input sm:w-auto">
            <option value="">Semua dojo</option>
            {dojoList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
          <button className="brutal-btn brutal-btn-dark">Filter</button>
        </form>
      )}

      <div className="space-y-3">
        {data.length === 0 && (
          <p className="brutal-card bg-emerald-50 p-6 text-center text-sm font-medium text-emerald-700">
            Tidak ada tunggakan. Semua iuran lunas.
          </p>
        )}
        {data.map((g) => (
          <div key={g.memberId} className="brutal-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">
                  {g.nama} <span className="font-normal text-slate-500">({g.memberId})</span>
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {g.dojo} · {g.items.length} bulan menunggak
                </p>
              </div>
              <p className="brutal-angka text-base text-orange-700">{rupiah(g.total)}</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {g.items.map((t) => (
                <li
                  key={t.id}
                  className="brutal-card flex items-center justify-between bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>
                    {labelPeriode(t.periode)} · jatuh tempo {formatTanggal(t.jatuhTempo)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="brutal-angka">{rupiah(t.nominal)}</span>
                    <BadgeIuran status={t.tampil} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
