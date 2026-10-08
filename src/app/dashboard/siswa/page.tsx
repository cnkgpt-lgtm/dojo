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
          <h1 className="brutal-title text-2xl uppercase">Data Siswa</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} siswa terdaftar
          </p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/siswa/tambah"
            className="brutal-btn brutal-btn-primary"
          >
            Tambah Siswa
          </Link>
        )}
      </div>

      <form method="get" className="brutal-card mb-5 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-semibold text-slate-700">
          Cari
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Nama atau Member ID"
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
        <label className="block text-sm font-semibold text-slate-700">
          Status
          <select name="status" defaultValue={sp.status ?? ""} className="brutal-input mt-1 block font-normal">
            <option value="">Semua status</option>
            {Object.entries(LABEL_STATUS_SISWA).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="brutal-btn brutal-btn-dark flex-1 sm:flex-none"
          >
            Cari
          </button>
          {(sp.q || sp.dojo || sp.status) && (
            <Link
              href="/dashboard/siswa"
              className="brutal-btn brutal-btn-light"
            >
              Atur ulang
            </Link>
          )}
        </div>
      </form>

      {data.length === 0 ? (
        <div className="brutal-card p-10 text-center">
          <p className="brutal-title text-lg uppercase">Belum ada data siswa</p>
          <p className="mt-1 text-sm text-slate-500">
            {sp.q || sp.dojo || sp.status
              ? "Tidak ada hasil yang cocok dengan filter. Coba ubah kata kunci."
              : "Tambahkan siswa pertama untuk mulai mengelola keanggotaan dojo."}
          </p>
          {u.role === "ADMIN" && !sp.q && (
            <Link
              href="/dashboard/siswa/tambah"
              className="brutal-btn brutal-btn-primary mt-4"
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
                  className="brutal-card flex items-center gap-3 p-4"
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
          <div className="brutal-card hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b-2 border-black text-xs uppercase">
                  <th scope="col" className="px-4 py-3 font-black">Siswa</th>
                  <th scope="col" className="px-4 py-3 font-black">Member ID</th>
                  <th scope="col" className="px-4 py-3 font-black">Dojo</th>
                  <th scope="col" className="px-4 py-3 font-black">Sabuk</th>
                  <th scope="col" className="px-4 py-3 font-black">Status</th>
                  <th scope="col" className="px-4 py-3 font-black"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} className="border-b border-black/10 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FotoKecil foto={s.foto} nama={s.nama} />
                        <span className="font-semibold">{s.nama}</span>
                      </div>
                    </td>
                    <td className="brutal-angka px-4 py-3 text-xs text-slate-600">{s.memberId}</td>
                    <td className="px-4 py-3 text-slate-600">{s.dojo.nama}</td>
                    <td className="px-4 py-3 text-slate-600">{s.sabuk?.nama ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} label={LABEL_STATUS_SISWA[s.status] ?? s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/siswa/${s.id}`}
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
