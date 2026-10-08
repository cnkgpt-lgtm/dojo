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
          <h1 className="brutal-title text-2xl">KELOLA PENGUMUMAN</h1>
          <p className="mt-1 text-sm text-slate-500">
            Buat, ubah, atau nonaktifkan pengumuman.
          </p>
        </div>
        <Link
          href="/dashboard/pengumuman/kelola/tambah"
          className="brutal-btn brutal-btn-primary shrink-0"
        >
          Buat Baru
        </Link>
      </div>

      {data.length === 0 ? (
        <div className="brutal-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-600">Belum ada pengumuman.</p>
          <p className="mt-1 text-sm text-slate-500">
            Tekan "Buat Baru" untuk pengumuman pertama.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map((p) => (
            <li key={p.id} className="brutal-card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="brutal-badge bg-dojo-100 text-dojo-800">
                  {labelTarget(p.target)}
                </span>
                {p.dojo && (
                  <span className="brutal-badge bg-slate-100 text-slate-700">
                    {p.dojo.nama}
                  </span>
                )}
                {!p.isActive && (
                  <span className="brutal-badge bg-slate-200 text-slate-600">
                    Nonaktif
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">{formatTanggal(p.createdAt)}</span>
              </div>
              <h2 className="brutal-title text-lg">{p.judul}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.isi}</p>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/dashboard/pengumuman/kelola/${p.id}/ubah`}
                  className="brutal-btn brutal-btn-light"
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
