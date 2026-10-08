import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibLogin } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { StatusBadge } from "@/components/StatusBadge";
import { HapusButton } from "@/components/HapusButton";
import { LABEL_STATUS_SISWA, LABEL_GENDER, formatTanggal, rupiah } from "@/lib/format";

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{nilai}</p>
    </div>
  );
}

export default async function DetailSiswaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibLogin();
  const { id } = await params;

  // Siswa hanya boleh melihat datanya sendiri (§59.14)
  if (u.role === "SISWA" && u.studentId !== id) redirect("/dashboard");

  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      dojo: { select: { id: true, nama: true } },
      sabuk: { select: { nama: true, warnaHex: true } },
    },
  });
  if (!s) redirect("/dashboard/siswa");

  if (u.role === "ADMIN" && u.scopeDojoId && s.dojoId !== u.scopeDojoId) redirect("/dashboard/siswa");
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!ids.includes(s.dojoId)) redirect("/dashboard/siswa");
  }

  const bolehKelola = u.role === "ADMIN";

  // Ringkasan kehadiran, iuran, dan perkembangan (§36)
  const [rekapHadir, tunggakan, riwayatSabuk, penilaianTerakhir] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { studentId: id },
      _count: { status: true },
    }),
    prisma.invoice.aggregate({
      where: { studentId: id, status: { in: ["BELUM_BAYAR", "TERLAMBAT"] } },
      _count: { id: true },
      _sum: { nominal: true },
    }),
    prisma.studentBeltHistory.findMany({
      where: { studentId: id },
      orderBy: { tanggal: "desc" },
      take: 5,
      include: {
        sabukLama: { select: { nama: true } },
        sabukBaru: { select: { nama: true } },
      },
    }),
    prisma.studentAssessment.findFirst({
      where: { studentId: id },
      orderBy: { periode: "desc" },
      include: { coach: { select: { nama: true } } },
    }),
  ]);
  const hadir = rekapHadir.find((r) => r.status === "HADIR")?._count.status ?? 0;
  const terlambat = rekapHadir.find((r) => r.status === "TERLAMBAT")?._count.status ?? 0;

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href={u.role === "SISWA" ? "/dashboard" : "/dashboard/siswa"}
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali
      </Link>

      <section aria-label="Identitas siswa" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-2xl font-extrabold text-slate-400 ring-1 ring-slate-200"
          >
            {s.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.foto} alt="" className="h-full w-full object-cover" />
            ) : (
              s.nama.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{s.nama}</h1>
              <StatusBadge status={s.status} label={LABEL_STATUS_SISWA[s.status] ?? s.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500">{s.memberId}</p>
            <p className="mt-1 text-sm text-slate-600">
              {s.dojo.nama} · Sabuk {s.sabuk?.nama ?? "belum ada"}
            </p>
          </div>
        </div>
        {bolehKelola && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/siswa/${s.id}/ubah`}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-semibold text-white"
            >
              Ubah Data
            </Link>
            <HapusButton nama={`siswa ${s.nama}`} endpoint={`/api/siswa/${s.id}`} kembaliKe="/dashboard/siswa" />
          </div>
        )}
      </section>

      <section aria-label="Data lengkap" className="mt-6 rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-x-8 px-6 sm:grid-cols-2">
          <div className="divide-y divide-slate-100">
            <Baris label="Nomor HP" nilai={s.phone ?? "-"} />
            <Baris label="Email" nilai={s.email ?? "-"} />
            <Baris label="Alamat" nilai={s.alamat ?? "-"} />
            <Baris label="Tempat, tanggal lahir" nilai={`${s.tempatLahir ?? "-"}, ${formatTanggal(s.tanggalLahir)}`} />
            <Baris label="Jenis kelamin" nilai={s.jenisKelamin ? (LABEL_GENDER[s.jenisKelamin] ?? "-") : "-"} />
          </div>
          <div className="divide-y divide-slate-100">
            <Baris label="Nama orang tua / wali" nilai={s.namaOrangTua ?? "-"} />
            <Baris label="HP orang tua / wali" nilai={s.phoneOrangTua ?? "-"} />
            <Baris label="Tanggal bergabung" nilai={formatTanggal(s.tanggalBergabung)} />
            <Baris label="Dojo" nilai={s.dojo.nama} />
            <Baris label="Catatan" nilai={s.catatan ?? "-"} />
          </div>
        </div>
      </section>

      <section aria-label="Ringkasan lain" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="font-semibold">Kehadiran</p>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-extrabold text-dojo-700">{hadir}</span> hadir ·{" "}
            <span className="font-extrabold text-amber-600">{terlambat}</span> terlambat
          </p>
          <Link
            href="/dashboard/absensi/riwayat"
            className="mt-2 inline-block text-xs font-bold text-dojo-700"
          >
            Lihat riwayat →
          </Link>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="font-semibold">Iuran</p>
          {tunggakan._count.id > 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-extrabold text-red-700">{tunggakan._count.id} tagihan</span>{" "}
              belum dibayar · {rupiah(tunggakan._sum.nominal ?? 0)}
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-emerald-700">Tidak ada tunggakan.</p>
          )}
          <Link href="/dashboard/iuran" className="mt-2 inline-block text-xs font-bold text-dojo-700">
            Lihat iuran →
          </Link>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="font-semibold">Perkembangan</p>
          {penilaianTerakhir ? (
            <p className="mt-2 text-sm text-slate-600">
              Penilaian terakhir periode{" "}
              <span className="font-bold">{penilaianTerakhir.periode}</span> oleh{" "}
              {penilaianTerakhir.coach.nama}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Belum ada penilaian.</p>
          )}
          {riwayatSabuk.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Kenaikan terakhir: {riwayatSabuk[0].sabukLama?.nama ?? "–"} →{" "}
              <span className="font-bold text-dojo-700">{riwayatSabuk[0].sabukBaru.nama}</span> (
              {formatTanggal(riwayatSabuk[0].tanggal)})
            </p>
          )}
        </div>
      </section>

      {riwayatSabuk.length > 0 && (
        <section aria-label="Riwayat sabuk" className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Riwayat Kenaikan Sabuk</h2>
          <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
            {riwayatSabuk.map((r) => (
              <li key={r.id} className="text-sm">
                <p>
                  <span className="font-semibold">{r.sabukLama?.nama ?? "–"}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-bold text-dojo-700">{r.sabukBaru.nama}</span>
                  {r.nilai && <span className="text-slate-500"> · Nilai: {r.nilai}</span>}
                </p>
                <p className="text-xs text-slate-500">{formatTanggal(r.tanggal)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
