import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { BayarForm } from "@/components/BayarForm";
import { BadgeIuran } from "@/components/BadgeIuran";
import { rupiah, formatTanggal} from "@/lib/format";
import { labelPeriode, statusTampilan } from "@/lib/iuran";

/** Hub iuran untuk admin: tarif, tagihan, tunggakan (§18, §19, §24). */
async function IuranHubAdmin() {
  const [jmlTarif, menunggu, tunggakan] = await Promise.all([
    prisma.feeSetting.count({ where: { isActive: true } }),
    prisma.payment.count({ where: { status: "MENUNGGU_VERIFIKASI" } }),
    prisma.invoice.findMany({
      where: { status: "BELUM_BAYAR" },
      select: { nominal: true, jatuhTempo: true, status: true },
    }),
  ]);
  const totalTunggakan = tunggakan
    .filter((t) => statusTampilan(t) !== "LUNAS")
    .reduce((s, t) => s + t.nominal, 0);

  const kartu = [
    {
      href: "/dashboard/iuran/tarif",
      judul: "Tarif Iuran",
      deskripsi: "Kelola tarif: default, per dojo, atau khusus siswa.",
      meta: `${jmlTarif} tarif aktif`,
    },
    {
      href: "/dashboard/tagihan",
      judul: "Tagihan",
      deskripsi: "Buat tagihan bulanan otomatis dan pantau status.",
      meta: "Generate per periode",
    },
    {
      href: "/dashboard/tunggakan",
      judul: "Tunggakan",
      deskripsi: "Rekap siswa yang belum membayar per bulan.",
      meta: `${rupiah(totalTunggakan)} menunggak`,
    },
    {
      href: "/dashboard/pembayaran",
      judul: "Verifikasi Pembayaran",
      deskripsi: "Setujui atau tolak bukti transfer siswa.",
      meta: `${menunggu} menunggu`,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {kartu.map((k) => (
        <Link
          key={k.href}
          href={k.href}
          className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 transition-shadow hover:shadow-md"
        >
          <p className="font-bold">{k.judul}</p>
          <p className="mt-1 text-sm text-slate-500">{k.deskripsi}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-dojo-700">{k.meta}</p>
        </Link>
      ))}
    </div>
  );
}

/** Tagihan & pembayaran untuk siswa (§64). */
async function IuranSiswa({ studentId }: { studentId: string }) {
  const rows = await prisma.invoice.findMany({
    where: { studentId },
    orderBy: [{ periode: "desc" }],
  });
  const tagihan = rows.map((r) => ({ ...r, tampil: statusTampilan(r) }));
  const terbuka = tagihan.filter(
    (t) => t.tampil === "BELUM_BAYAR" || t.tampil === "TERLAMBAT" || t.status === "DITOLAK"
  );
  const riwayat = tagihan.filter((t) => !terbuka.includes(t));
  const totalTunggakan = terbuka.reduce((s, t) => s + t.nominal, 0);

  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">
        Tagihan iuran bulanan Anda. Bayar via transfer lalu upload bukti untuk diverifikasi admin.
      </p>

      {totalTunggakan > 0 && (
        <div className="mb-6 rounded-2xl bg-orange-50 p-5 ring-1 ring-orange-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Total tunggakan</p>
          <p className="mt-1 text-2xl font-extrabold text-orange-700">{rupiah(totalTunggakan)}</p>
          <p className="mt-1 text-xs text-orange-600">{terbuka.length} tagihan belum dibayar</p>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-base font-bold">Tagihan</h2>
        <div className="space-y-3">
          {terbuka.length === 0 && (
            <p className="rounded-2xl bg-emerald-50 p-6 text-center text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
              Tidak ada tagihan yang perlu dibayar.
            </p>
          )}
          {terbuka.map((t) => (
            <div key={t.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">Iuran {labelPeriode(t.periode)}</p>
                  <p className="mt-0.5 text-sm text-slate-500">Jatuh tempo {formatTanggal(t.jatuhTempo)}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-extrabold">{rupiah(t.nominal)}</p>
                  <div className="mt-1">
                    <BadgeIuran status={t.tampil} />
                  </div>
                </div>
              </div>
              <BayarForm
                tagihan={{ id: t.id, periode: t.periode, nominal: t.nominal, statusTampilan: t.tampil }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Riwayat</h2>
          <Link href="/dashboard/pembayaran" className="text-sm font-semibold text-dojo-700 underline">
            Lihat semua pembayaran
          </Link>
        </div>
        <div className="space-y-2">
          {riwayat.length === 0 && (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              Belum ada riwayat.
            </p>
          )}
          {riwayat.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
            >
              <div>
                <p className="text-sm font-bold">Iuran {labelPeriode(t.periode)}</p>
                <p className="text-xs text-slate-500">{rupiah(t.nominal)}</p>
              </div>
              <BadgeIuran status={t.tampil} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default async function IuranPage() {
  const u = await wajibRole("ADMIN", "SISWA");

  return (
    <div className="anim-fade-up mx-auto max-w-4xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Iuran</h1>
      {u.role === "ADMIN" && (
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Kelola tarif, tagihan bulanan, tunggakan, dan verifikasi pembayaran.
        </p>
      )}
      {u.role === "ADMIN" ? (
        <IuranHubAdmin />
      ) : u.studentId ? (
        <IuranSiswa studentId={u.studentId} />
      ) : (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Akun ini tidak terhubung ke data siswa.
        </p>
      )}
    </div>
  );
}
