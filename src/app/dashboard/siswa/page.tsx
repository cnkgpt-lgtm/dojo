import Link from "next/link";
import { prisma } from "@/lib/db";
import { Prisma, StudentStatus } from "@prisma/client";
import { wajibRole, type SesiPengguna } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { Pagination } from "@/components/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { LABEL_STATUS_SISWA } from "@/lib/format";

const PER_HALAMAN = 10;

type SearchParams = { q?: string; dojo?: string; status?: string; page?: string };

async function bangunWhere(u: SesiPengguna, sp: SearchParams): Promise<Prisma.StudentWhereInput> {
  const where: Prisma.StudentWhereInput = {};
  const q = sp.q?.trim();
  if (q) {
    where.OR = [
      { nama: { contains: q, mode: "insensitive" } },
      { memberId: { contains: q, mode: "insensitive" } },
    ];
  }
  if (sp.status && (Object.keys(LABEL_STATUS_SISWA) as string[]).includes(sp.status))
    where.status = sp.status as StudentStatus;

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.dojo) {
      where.dojoId = sp.dojo;
    }
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
  if (sp.status) p.set("status", sp.status);
  p.set("page", String(halaman));
  return `/dashboard/siswa?${p.toString()}`;
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

export default async function SiswaListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const sp = await searchParams;
  const halaman = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = await bangunWhere(u, sp);

  const [total, data] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { nama: "asc" },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        dojo: { select: { id: true, nama: true } },
        sabuk: { select: { nama: true } },
      },
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
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Data Siswa</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} siswa terdaftar
          </p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/siswa/tambah"
            className="inline-flex min-h-[44px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-semibold text-white"
          >
            Tambah Siswa
          </Link>
        )}
      </div>

      <form method="get" className="mb-5 grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-semibold text-slate-700">
          Cari
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nama atau Member ID"
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
        <label className="block text-sm font-semibold text-slate-700">
          Status
          <select name="status" defaultValue={sp.status ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
            <option value="">Semua status</option>
            {Object.entries(LABEL_STATUS_SISWA).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white sm:flex-none"
          >
            Cari
          </button>
          {(sp.q || sp.dojo || sp.status) && (
            <Link
              href="/dashboard/siswa"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
            >
              Atur ulang
            </Link>
          )}
        </div>
      </form>

      {data.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-10 text-center ring-1 ring-slate-200">
          <p className="font-semibold">Belum ada data siswa</p>
          <p className="mt-1 text-sm text-slate-500">
            {sp.q || sp.dojo || sp.status
              ? "Tidak ada hasil yang cocok dengan filter. Coba ubah kata kunci."
              : "Tambahkan siswa pertama untuk mulai mengelola keanggotaan dojo."}
          </p>
          {u.role === "ADMIN" && !sp.q && (
            <Link
              href="/dashboard/siswa/tambah"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-semibold text-white"
            >
              Tambah Siswa
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Kartu untuk layar kecil */}
          <ul className="space-y-3 sm:hidden">
            {data.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/siswa/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                >
                  <FotoKecil foto={s.foto} nama={s.nama} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.nama}</p>
                    <p className="truncate text-xs text-slate-500">
                      {s.memberId} · {s.dojo.nama}
                    </p>
                  </div>
                  <StatusBadge status={s.status} label={LABEL_STATUS_SISWA[s.status] ?? s.status} />
                </Link>
              </li>
            ))}
          </ul>

          {/* Tabel untuk layar besar */}
          <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-slate-200 sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Siswa</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Member ID</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Dojo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Sabuk</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FotoKecil foto={s.foto} nama={s.nama} />
                        <span className="font-semibold">{s.nama}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.memberId}</td>
                    <td className="px-4 py-3 text-slate-600">{s.dojo.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{s.sabuk?.nama ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} label={LABEL_STATUS_SISWA[s.status] ?? s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/siswa/${s.id}`}
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
