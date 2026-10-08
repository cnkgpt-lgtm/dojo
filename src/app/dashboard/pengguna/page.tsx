import { prisma, Prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { PenggunaForm } from "@/components/PenggunaForm";
import { PenggunaAksi } from "@/components/PenggunaAksi";
import type { Role } from "@prisma/client";

const LABEL_ROLE = { ADMIN: "Admin", SENSEI: "Sensei", SISWA: "Siswa" } as const;

type SearchParams = { q?: string; role?: string };

/** Kelola akun login: tambah pengguna + pilih role, nonaktifkan, reset sandi (§57). Khusus admin. */
export default async function PenggunaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const u = await wajibRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const roleParam = sp.role === "ADMIN" || sp.role === "SENSEI" || sp.role === "SISWA"
    ? (sp.role as Role)
    : undefined;

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(roleParam ? { role: roleParam } : {}),
  };

  const [pengguna, dojoList] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        scopeDojo: { select: { nama: true } },
        student: { select: { memberId: true } },
      },
    }),
    prisma.dojo.findMany({ orderBy: { nama: "asc" }, select: { id: true, nama: true } }),
  ]);

  return (
    <div className="anim-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pengguna</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pengguna.length} akun terdaftar · kelola login tiap role
          </p>
        </div>
      </div>

      <PenggunaForm dojoList={dojoList} />

      {/* Filter */}
      <form method="get" className="mb-4 mt-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cari nama / HP / email"
          className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-4 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100 sm:max-w-xs"
        />
        <select
          name="role"
          defaultValue={roleParam ?? ""}
          className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Semua role</option>
          <option value="ADMIN">Admin</option>
          <option value="SENSEI">Sensei</option>
          <option value="SISWA">Siswa</option>
        </select>
        <button
          type="submit"
          className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-bold text-white"
        >
          Cari
        </button>
      </form>

      {/* Daftar */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Login</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pengguna.map((p) => (
              <tr key={p.id} className={!p.isActive ? "bg-slate-50" : undefined}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{p.name}</p>
                  {p.student && <p className="text-xs text-slate-500">{p.student.memberId}</p>}
                  {p.scopeDojo && <p className="text-xs text-slate-500">Scope: {p.scopeDojo.nama}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.phone}</p>
                  {p.email && <p className="text-xs text-slate-500">{p.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      p.role === "ADMIN"
                        ? "bg-dojo-100 text-dojo-800"
                        : p.role === "SENSEI"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {LABEL_ROLE[p.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                      p.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <PenggunaAksi id={p.id} nama={p.name} isActive={p.isActive} milikSendiri={p.id === u.id} />
                </td>
              </tr>
            ))}
            {pengguna.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Tidak ada pengguna yang cocok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
