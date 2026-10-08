import Link from "next/link";
import { prisma, Prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { GenerateTagihanForm } from "@/components/GenerateTagihanForm";
import { BadgeIuran } from "@/components/BadgeIuran";
import { rupiah, formatTanggal} from "@/lib/format";
import { labelPeriode } from "@/lib/iuran";
import { statusTampilan } from "@/lib/iuran";

const PER_HALAMAN = 15;

export default async function TagihanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await wajibRole("ADMIN");
  const sp = await searchParams;
  const periode = sp.periode ?? "";
  const status = sp.status ?? "";
  const dojoFilter = sp.dojo ?? "";
  const halaman = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.InvoiceWhereInput = {};
  if (periode) where.periode = periode;
  if (status && status !== "TERLAMBAT") where.status = status as Prisma.InvoiceWhereInput["status"];
  if (status === "TERLAMBAT") where.status = "BELUM_BAYAR";
  if (u.scopeDojoId) where.dojoId = u.scopeDojoId;
  else if (dojoFilter) where.dojoId = dojoFilter;

  const [total, rows, dojoList] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ periode: "desc" }, { jatuhTempo: "asc" }],
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        student: { select: { nama: true, memberId: true } },
        dojo: { select: { id: true, nama: true } },
      },
    }),
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ]);

  let data = rows.map((r) => ({ ...r, tampil: statusTampilan(r) }));
  if (status === "TERLAMBAT") data = data.filter((r) => r.tampil === "TERLAMBAT");
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const q = (p: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...p })) if (v) params.set(k, v);
    return `?${params.toString()}`;
  };

  return (
    <div className="anim-fade-up mx-auto max-w-6xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Tagihan Iuran</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Buat tagihan bulanan otomatis, lalu pantau status pembayaran tiap siswa.
      </p>

      <GenerateTagihanForm dojoList={dojoList} />

      {/* Filter */}
      <form method="get" className="mt-6 flex flex-wrap gap-3">
        <input
          name="periode"
          defaultValue={periode}
          placeholder="Periode: 2026-11"
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
        />
        <select name="status" defaultValue={status} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">
          <option value="">Semua status</option>
          <option value="BELUM_BAYAR">Belum Bayar</option>
          <option value="TERLAMBAT">Terlambat</option>
          <option value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</option>
          <option value="LUNAS">Lunas</option>
          <option value="DITOLAK">Ditolak</option>
        </select>
        {dojoList.length > 1 && (
          <select name="dojo" defaultValue={dojoFilter} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">
            <option value="">Semua dojo</option>
            {dojoList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
        )}
        <button className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">
          Filter
        </button>
      </form>

      {/* Daftar */}
      <div className="mt-4 space-y-2">
        {data.length === 0 && (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada tagihan. Buat tagihan periode berjalan lewat formulir di atas.
          </p>
        )}
        {data.map((t) => (
          <div
            key={t.id}
            className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:flex sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-bold">
                {t.student.nama} <span className="font-normal text-slate-500">({t.student.memberId})</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {labelPeriode(t.periode)} · {t.dojo.nama} · jatuh tempo {formatTanggal(t.jatuhTempo)}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3 sm:mt-0">
              <span className="text-sm font-extrabold">{rupiah(t.nominal)}</span>
              <BadgeIuran status={t.tampil} />
            </div>
          </div>
        ))}
      </div>

      {totalHalaman > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Halaman {halaman} dari {totalHalaman}
          </span>
          <div className="flex gap-2">
            {halaman > 1 && (
              <Link href={q({ page: String(halaman - 1) })} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold">
                Sebelumnya
              </Link>
            )}
            {halaman < totalHalaman && (
              <Link href={q({ page: String(halaman + 1) })} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold">
                Berikutnya
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
