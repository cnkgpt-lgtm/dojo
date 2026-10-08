import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { wherePengumumanTerbaca, labelTarget } from "@/lib/pengumuman";
import { formatTanggal } from "@/lib/format";
import { HapusButton } from "@/components/HapusButton";

/** GET /dashboard/pengumuman/kelola — kelola pengumuman (admin only, §44). */
export default async function KelolaPengumumanPage() {
  const u = await wajibRole("ADMIN");
  const where = await wherePengumumanTerbaca(u);

  const data = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { dojo: { select: { nama: true } } },
  });

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/pengumuman"
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali ke pengumuman
      </Link>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Kelola Pengumuman</h1>
          <p className="mt-1 text-sm text-slate-500">
            Buat, ubah, atau nonaktifkan pengumuman.
          </p>
        </div>
        <Link
          href="/dashboard/pengumuman/kelola/tambah"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-dojo-700 px-4 text-sm font-bold text-white"
        >
          Buat Baru
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-6 py-12 text-center ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-600">Belum ada pengumuman.</p>
          <p className="mt-1 text-sm text-slate-500">
            Tekan "Buat Baru" untuk pengumuman pertama.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map((p) => (
            <li key={p.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-dojo-50 px-2.5 py-1 text-[11px] font-bold text-dojo-800">
                  {labelTarget(p.target)}
                </span>
                {p.dojo && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {p.dojo.nama}
                  </span>
                )}
                {!p.isActive && (
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                    Nonaktif
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">{formatTanggal(p.createdAt)}</span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight">{p.judul}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.isi}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/pengumuman/kelola/${p.id}/ubah`}
                  className="inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-dojo-700 ring-1 ring-slate-200"
                >
                  Ubah
                </Link>
                <HapusButton
                  nama={`pengumuman "${p.judul}"`}
                  endpoint={`/api/pengumuman/${p.id}`}
                  kembaliKe="/dashboard/pengumuman/kelola"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
