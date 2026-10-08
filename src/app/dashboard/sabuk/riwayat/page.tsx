import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { formatTanggal } from "@/lib/format";
import { Pagination } from "@/components/Pagination";

const PER_HALAMAN = 20;

export default async function RiwayatSabukPage({
  searchParams,
}: {
  searchParams: Promise<{ dojo?: string; dari?: string; sampai?: string; halaman?: string }>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const q = await searchParams;
  const halaman = Math.max(1, Number(q.halaman) || 1);

  const dojoIds =
    u.role === "ADMIN"
      ? u.scopeDojoId
        ? [u.scopeDojoId]
        : undefined
      : await dojoIdsUntukSensei(u.coachId);

  const where = {
    ...(q.dojo ? { student: { dojoId: q.dojo } } : {}),
    ...(q.dari ? { tanggal: { gte: new Date(q.dari) } } : {}),
    ...(q.sampai ? { tanggal: { lte: new Date(q.sampai) } } : {}),
  };
  const scopeDojo = dojoIds ? { student: { dojoId: { in: dojoIds } } } : {};

  const [total, riwayat, dojoList] = await Promise.all([
    prisma.studentBeltHistory.count({ where: { ...where, ...scopeDojo } }),
    prisma.studentBeltHistory.findMany({
      where: { ...where, ...scopeDojo },
      orderBy: { tanggal: "desc" },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        student: {
          select: { nama: true, memberId: true, dojo: { select: { nama: true } } },
        },
        sabukLama: { select: { nama: true } },
        sabukBaru: { select: { nama: true } },
        penguji: { select: { name: true } },
      },
    }),
    u.role === "ADMIN"
      ? prisma.dojo.findMany({
          where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
          orderBy: { nama: "asc" },
          select: { id: true, nama: true },
        })
      : [],
  ]);

  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  return (
    <div className="anim-fade-up mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brutal-title text-2xl">RIWAYAT KENAIKAN SABUK</h1>
          <p className="mt-1 text-sm text-slate-500">{total} catatan kenaikan.</p>
        </div>
        <Link
          href="/dashboard/sabuk/kenaikan"
          className="brutal-btn brutal-btn-primary"
        >
          Catat Kenaikan
        </Link>
      </div>

      <form className="brutal-card mb-6 grid gap-3 p-4 sm:grid-cols-4">
        {u.role === "ADMIN" && (
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dojo</span>
            <select
              name="dojo"
              defaultValue={q.dojo ?? ""}
              className="brutal-input mt-1"
            >
              <option value="">Semua dojo</option>
              {dojoList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dari</span>
          <input
            type="date"
            name="dari"
            defaultValue={q.dari ?? ""}
            className="brutal-input mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sampai</span>
          <input
            type="date"
            name="sampai"
            defaultValue={q.sampai ?? ""}
            className="brutal-input mt-1"
          />
        </label>
        <div className="flex items-end">
          <button className="brutal-btn brutal-btn-dark w-full">
            Filter
          </button>
        </div>
      </form>

      <div className="brutal-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Siswa</th>
              <th className="px-4 py-3">Kenaikan</th>
              <th className="px-4 py-3">Penguji</th>
            </tr>
          </thead>
          <tbody>
            {riwayat.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 whitespace-nowrap">{formatTanggal(r.tanggal)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{r.student.nama}</p>
                  <p className="text-xs text-slate-500">
                    {r.student.memberId} · {r.student.dojo.nama}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold">{r.sabukLama?.nama ?? "–"}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-bold text-dojo-700">{r.sabukBaru.nama}</span>
                  {r.nilai && <p className="text-xs text-slate-500">Nilai: {r.nilai}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.penguji?.name ?? "–"}</td>
              </tr>
            ))}
            {riwayat.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Belum ada riwayat kenaikan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          halaman={halaman}
          totalHalaman={totalHalaman}
          buatHref={(h) => {
            const p = new URLSearchParams();
            if (q.dojo) p.set("dojo", q.dojo);
            if (q.dari) p.set("dari", q.dari);
            if (q.sampai) p.set("sampai", q.sampai);
            p.set("halaman", String(h));
            return `/dashboard/sabuk/riwayat?${p.toString()}`;
          }}
        />
      </div>
    </div>
  );
}
