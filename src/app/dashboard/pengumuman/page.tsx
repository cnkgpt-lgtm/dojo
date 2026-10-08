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
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Pengumuman</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kabar terbaru dari dojo dan pengurus.
          </p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/pengumuman/kelola"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-dojo-700 px-4 text-sm font-bold text-white"
          >
            Kelola
          </Link>
        )}
      </div>

      {data.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-6 py-12 text-center ring-1 ring-slate-200">
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
              className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-dojo-50 px-2.5 py-1 text-[11px] font-bold text-dojo-800">
                  {labelTarget(p.target)}
                </span>
                {p.dojo && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {p.dojo.nama}
                  </span>
                )}
                <span className="ml-auto text-xs text-slate-400">
                  {formatTanggal(p.createdAt)}
                </span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight">{p.judul}</h2>
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
