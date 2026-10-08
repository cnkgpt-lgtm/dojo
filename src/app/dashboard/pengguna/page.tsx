import { prisma, Prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { PenggunaForm } from "@/components/PenggunaForm";
import { PenggunaAksi } from "@/components/PenggunaAksi";
import type { Role } from "@prisma/client";

const LABEL_ROLE = { ADMIN: "Admin", SENSEI: "Sensei", SISWA: "Siswa" } as const;

type SearchParams = { q?: string; role?: string };

const GAYA_ROLE: Record<Role, string> = {
  ADMIN: "brutal-badge bg-dojo-600 text-white",
  SENSEI: "brutal-badge bg-amber-300 text-black",
  SISWA: "brutal-badge bg-sky-200 text-black",
};

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
          <h1 className="brutal-title text-2xl uppercase">Pengguna</h1>
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
          className="brutal-input flex-1 sm:max-w-xs"
        />
        <select
          name="role"
          defaultValue={roleParam ?? ""}
          className="brutal-input sm:w-auto"
        >
          <option value="">Semua role</option>
          <option value="ADMIN">Admin</option>
          <option value="SENSEI">Sensei</option>
          <option value="SISWA">Siswa</option>
        </select>
        <button
          type="submit"
          className="brutal-btn brutal-btn-dark"
        >
          Cari
        </button>
      </form>

      {/* Daftar */}
      <div className="brutal-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-black text-xs uppercase">
              <th className="px-4 py-3 font-black">Nama</th>
              <th className="px-4 py-3 font-black">Login</th>
              <th className="px-4 py-3 font-black">Role</th>
              <th className="px-4 py-3 font-black">Status</th>
              <th className="px-4 py-3 font-black"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {pengguna.map((p) => (
              <tr key={p.id} className={!p.isActive ? "bg-black/[0.03]" : undefined}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{p.name}</p>
                  {p.student && <p className="brutal-angka text-xs text-slate-500">{p.student.memberId}</p>}
                  {p.scopeDojo && <p className="text-xs text-slate-500">Scope: {p.scopeDojo.nama}</p>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.phone}</p>
                  {p.email && <p className="text-xs text-slate-500">{p.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={GAYA_ROLE[p.role]}>
                    {LABEL_ROLE[p.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`brutal-badge ${p.isActive ? "bg-emerald-300 text-black" : "bg-neutral-200 text-neutral-700"}`}
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
