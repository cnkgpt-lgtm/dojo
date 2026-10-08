import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibLogin } from "@/lib/authz";
import { wherePengumumanTerbaca, labelTarget } from "@/lib/pengumuman";
import { formatTanggal } from "@/lib/format";

/** GET /dashboard/pengumuman — daftar pengumuman untuk semua role (§44). */
export default async function PengumumanPage() {
  const u = await wajibLogin();
  const where = await wherePengumumanTerbaca(u);

  const data = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      dojo: { select: { nama: true } },
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="brutal-title text-2xl">PENGUMUMAN</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kabar terbaru dari dojo dan pengurus.
          </p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/pengumuman/kelola"
            className="brutal-btn brutal-btn-primary shrink-0"
          >
            Kelola
          </Link>
        )}
      </div>

      {data.length === 0 ? (
        <div className="brutal-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-600">Belum ada pengumuman.</p>
          <p className="mt-1 text-sm text-slate-500">
            Pengumuman dari pengurus akan tampil di sini.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map((p) => (
            <li
              key={p.id}
              className="brutal-card p-5"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="brutal-badge bg-dojo-100 text-dojo-800">
                  {labelTarget(p.target)}
                </span>
                {p.dojo && (
                  <span className="brutal-badge bg-slate-100 text-slate-700">
                    {p.dojo.nama}
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {formatTanggal(p.createdAt)}
                </span>
              </div>
              <h2 className="brutal-title text-lg">{p.judul}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {p.isi}
              </p>
              {(p.tanggalMulai || p.tanggalSelesai) && (
                <p className="mt-3 text-xs text-slate-400">
                  Berlaku: {formatTanggal(p.tanggalMulai)}
                  {p.tanggalSelesai ? ` – ${formatTanggal(p.tanggalSelesai)}` : " – seterusnya"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
