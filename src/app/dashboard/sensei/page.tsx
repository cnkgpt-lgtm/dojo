import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { wajibRole, type SesiPengguna } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { Pagination } from "@/components/Pagination";

const PER_HALAMAN = 10;

type SearchParams = { q?: string; dojo?: string; page?: string };

async function bangunWhere(u: SesiPengguna, sp: SearchParams): Promise<Prisma.CoachWhereInput> {
  const where: Prisma.CoachWhereInput = {};
  const q = sp.q?.trim();
  if (q) where.nama = { contains: q, mode: "insensitive" };

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) where.dojoId = u.scopeDojoId;
    else if (sp.dojo) where.dojoId = sp.dojo;
  } else {
    const ids = await dojoIdsUntukSensei(u.coachId);
    const dipilih = sp.dojo && ids.includes(sp.dojo) ? [sp.dojo] : ids;
    where.dojoId = { in: dipilih.length > 0 ? dipilih : ["__kosong__"] };
  }
  return where;
}

function buatHref(sp: SearchParams, halaman: number): string {
  const p = new URLSearchParams();
  if (sp.q) p.set("q", sp.q);
  if (sp.dojo) p.set("dojo", sp.dojo);
  p.set("page", String(halaman));
  return `/dashboard/sensei?${p.toString()}`;
}

function FotoKecil({ foto, nama }: { foto: string | null; nama: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-extrabold text-slate-500 ring-1 ring-slate-200"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="h-full w-full object-cover" />
      ) : (
        nama.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default async function SenseiListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const sp = await searchParams;
  const halaman = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = await bangunWhere(u, sp);

  const [total, data] = await Promise.all([
    prisma.coach.count({ where }),
    prisma.coach.findMany({
      where,
      orderBy: { nama: "asc" },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: { dojo: { select: { id: true, nama: true } } },
    }),
  ]);
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  const tampilFilterDojo = u.role === "ADMIN" && !u.scopeDojoId;
  const daftarDojo = tampilFilterDojo
    ? await prisma.dojo.findMany({ where: { isActive: true }, orderBy: { nama: "asc" }, select: { id: true, nama: true } })
    : [];

  return (
    <div className="anim-fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Data Sensei</h1>
          <p className="mt-1 text-sm text-slate-500">{total} sensei terdaftar</p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/sensei/tambah"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-semibold text-white"
          >
            Tambah Sensei
          </Link>
        )}
      </div>

      <form method="get" className="mb-5 grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-semibold text-slate-700">
          Cari
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nama sensei"
            className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
          />
        </label>
        {tampilFilterDojo && (
          <label className="block text-sm font-semibold text-slate-700">
            Dojo
            <select name="dojo" defaultValue={sp.dojo ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
              <option value="">Semua dojo</option>
              {daftarDojo.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white sm:flex-none"
          >
            Cari
          </button>
          {(sp.q || sp.dojo) && (
            <Link
              href="/dashboard/sensei"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
            >
              Atur ulang
            </Link>
          )}
        </div>
      </form>

      {data.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-10 text-center ring-1 ring-slate-200">
          <p className="font-semibold">Belum ada data sensei</p>
          <p className="mt-1 text-sm text-slate-500">
            {sp.q || sp.dojo
              ? "Tidak ada hasil yang cocok dengan filter. Coba ubah kata kunci."
              : "Tambahkan sensei pertama untuk mulai mengelola pelatih dojo."}
          </p>
          {u.role === "ADMIN" && !sp.q && (
            <Link
              href="/dashboard/sensei/tambah"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-semibold text-white"
            >
              Tambah Sensei
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {data.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/sensei/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                >
                  <FotoKecil foto={c.foto} nama={c.nama} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nama}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.dojo?.nama ?? "Tanpa dojo tetap"}
                      {c.spesialisasi ? ` · ${c.spesialisasi}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                      c.isActive
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                    }`}
                  >
                    {c.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-slate-200 sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Sensei</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Dojo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Spesialisasi</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Kontak</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FotoKecil foto={c.foto} nama={c.nama} />
                        <span className="font-semibold">{c.nama}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.dojo?.nama ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.spesialisasi ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          c.isActive
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {c.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/sensei/${c.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-dojo-700 ring-1 ring-slate-200"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination halaman={halaman} totalHalaman={totalHalaman} buatHref={(h) => buatHref(sp, h)} />
        </>
      )}
    </div>
  );
}
