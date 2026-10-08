import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import {
  ASPEK_PENILAIAN,
  getSkalaPenilaian,
  rataRata,
  tampilNilai,
  gayaBadgeSabuk,
} from "@/lib/sabuk";
import { formatTanggal } from "@/lib/format";

export default async function PerkembanganPage() {
  const u = await wajibRole("SISWA");
  if (!u.studentId) return <p className="p-6">Akun Anda tidak terhubung ke data siswa.</p>;

  const [siswa, riwayatSabuk, penilaian] = await Promise.all([
    prisma.student.findUnique({
      where: { id: u.studentId },
      include: { sabuk: true, dojo: { select: { nama: true } } },
    }),
    prisma.studentBeltHistory.findMany({
      where: { studentId: u.studentId },
      orderBy: { tanggal: "desc" },
      include: {
        sabukLama: { select: { nama: true, warnaHex: true } },
        sabukBaru: { select: { nama: true, warnaHex: true } },
      },
    }),
    prisma.studentAssessment.findMany({
      where: { studentId: u.studentId },
      orderBy: { periode: "desc" },
      take: 6,
      include: { coach: { select: { nama: true } } },
    }),
  ]);
  if (!siswa) return <p className="p-6">Data siswa tidak ditemukan.</p>;

  const skala = await getSkalaPenilaian();
  const terakhir = penilaian[0] ?? null;
  const nilaiTerakhir: Record<string, number | null | undefined> = {};
  if (terakhir) {
    for (const a of ASPEK_PENILAIAN) {
      nilaiTerakhir[a.key] = terakhir[a.key as keyof typeof terakhir] as number | null;
    }
  }
  const rata = terakhir ? rataRata(nilaiTerakhir) : null;

  return (
    <div className="anim-fade-up mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Perkembanganku</h1>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-bold">Sabuk Saat Ini</h2>
        <div className="mt-3 flex items-center gap-3">
          <span
            className="rounded-full px-4 py-1.5 text-sm font-extrabold text-white"
            style={gayaBadgeSabuk(siswa.sabuk?.warnaHex)}
          >
            {siswa.sabuk?.nama ?? "Belum ada"}
          </span>
          <span className="text-sm text-slate-500">{siswa.dojo.nama}</span>
        </div>
        {riwayatSabuk.length > 0 && (
          <ol className="mt-4 space-y-2 border-l-2 border-slate-200 pl-4">
            {riwayatSabuk.map((r) => (
              <li key={r.id} className="text-sm">
                <p>
                  <span className="font-semibold">{r.sabukLama?.nama ?? "–"}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="font-bold text-dojo-700">{r.sabukBaru.nama}</span>
                </p>
                <p className="text-xs text-slate-500">{formatTanggal(r.tanggal)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-bold">Penilaian Terakhir</h2>
        {!terakhir && (
          <p className="mt-2 text-sm text-slate-500">
            Belum ada penilaian dari sensei.
          </p>
        )}
        {terakhir && (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Periode {terakhir.periode} · oleh {terakhir.coach.nama}
              {rata != null && (
                <span className="ml-2 rounded-full bg-dojo-700/10 px-2.5 py-0.5 font-extrabold text-dojo-700">
                  Rata-rata: {skala === "LABEL" ? tampilNilai(Math.round(rata), skala) : rata}
                </span>
              )}
            </p>
            <div className="mt-4 space-y-2.5">
              {ASPEK_PENILAIAN.map((a) => {
                const v = nilaiTerakhir[a.key];
                return (
                  <div key={a.key}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{a.label}</span>
                      <span className="font-bold">{tampilNilai(v, skala)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-dojo-700"
                        style={{ width: `${((v ?? 0) / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {terakhir.catatan && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-100">
                <span className="font-semibold">Catatan sensei:</span> {terakhir.catatan}
              </p>
            )}
          </>
        )}
      </section>

      {penilaian.length > 1 && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Riwayat Penilaian</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {penilaian.slice(1).map((p) => (
              <li key={p.id} className="py-2.5">
                <span className="font-semibold">Periode {p.periode}</span>
                <span className="text-slate-500"> · oleh {p.coach.nama}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/dashboard/profil"
        className="inline-block rounded-xl px-5 py-2.5 font-bold text-dojo-700 ring-1 ring-dojo-700/30"
      >
        Lihat Profil Lengkap
      </Link>
    </div>
  );
}
