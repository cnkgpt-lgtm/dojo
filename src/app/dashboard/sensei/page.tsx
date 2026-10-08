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
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-black bg-slate-100 text-sm font-extrabold text-slate-500"
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
          <h1 className="brutal-title text-2xl uppercase">Data Sensei</h1>
          <p className="mt-1 text-sm text-slate-500">{total} sensei terdaftar</p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/sensei/tambah"
            className="brutal-btn brutal-btn-primary"
          >
            Tambah Sensei
          </Link>
        )}
      </div>

      <form method="get" className="brutal-card mb-5 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-semibold text-slate-700">
          Cari
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nama sensei"
            className="brutal-input mt-1 block font-normal"
          />
        </label>
        {tampilFilterDojo && (
          <label className="block text-sm font-semibold text-slate-700">
            Dojo
            <select name="dojo" defaultValue={sp.dojo ?? ""} className="brutal-input mt-1 block font-normal">
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
            className="brutal-btn brutal-btn-dark flex-1 sm:flex-none"
          >
            Cari
          </button>
          {(sp.q || sp.dojo) && (
            <Link
              href="/dashboard/sensei"
              className="brutal-btn brutal-btn-light"
            >
              Atur ulang
            </Link>
          )}
        </div>
      </form>

      {data.length === 0 ? (
        <div className="brutal-card p-10 text-center">
          <p className="brutal-title text-lg uppercase">Belum ada data sensei</p>
          <p className="mt-1 text-sm text-slate-500">
            {sp.q || sp.dojo
              ? "Tidak ada hasil yang cocok dengan filter. Coba ubah kata kunci."
              : "Tambahkan sensei pertama untuk mulai mengelola pelatih dojo."}
          </p>
          {u.role === "ADMIN" && !sp.q && (
            <Link
              href="/dashboard/sensei/tambah"
              className="brutal-btn brutal-btn-primary mt-4"
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
                  className="brutal-card flex items-center gap-3 p-4"
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
                    className={`brutal-badge ${c.isActive ? "bg-emerald-300 text-black" : "bg-neutral-200 text-neutral-700"}`}
                  >
                    {c.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="brutal-card hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b-2 border-black text-xs uppercase">
                  <th scope="col" className="px-4 py-3 font-black">Sensei</th>
                  <th scope="col" className="px-4 py-3 font-black">Dojo</th>
                  <th scope="col" className="px-4 py-3 font-black">Spesialisasi</th>
                  <th scope="col" className="px-4 py-3 font-black">Kontak</th>
                  <th scope="col" className="px-4 py-3 font-black">Status</th>
                  <th scope="col" className="px-4 py-3 font-black"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b border-black/10 last:border-0">
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
                        className={`brutal-badge ${c.isActive ? "bg-emerald-300 text-black" : "bg-neutral-200 text-neutral-700"}`}
                      >
                        {c.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/sensei/${c.id}`}
                        className="brutal-btn brutal-btn-light"
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
