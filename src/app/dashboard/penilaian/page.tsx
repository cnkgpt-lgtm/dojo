import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { PenilaianForm } from "@/components/PenilaianForm";
import { PenilaianRow } from "@/components/PenilaianRow";
import { ASPEK_PENILAIAN, getSkalaPenilaian, rataRata, tampilNilai } from "@/lib/sabuk";
import { formatTanggal } from "@/lib/format";

export default async function PenilaianPage({
  searchParams,
}: {
  searchParams: Promise<{ siswa?: string }>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const q = await searchParams;
  const skala = await getSkalaPenilaian();

  const dojoIds =
    u.role === "ADMIN" ? (u.scopeDojoId ? [u.scopeDojoId] : undefined) : await dojoIdsUntukSensei(u.coachId);

  const siswaList = await prisma.student.findMany({
    where: {
      status: "AKTIF",
      ...(dojoIds ? { dojoId: { in: dojoIds } } : {}),
    },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, memberId: true },
  });

  const riwayat = await prisma.studentAssessment.findMany({
    where: {
      ...(q.siswa ? { studentId: q.siswa } : {}),
      ...(dojoIds ? { student: { dojoId: { in: dojoIds } } } : {}),
      ...(u.role === "SENSEI" ? { coachId: u.coachId ?? undefined } : {}),
    },
    orderBy: [{ periode: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      student: { select: { id: true, nama: true, memberId: true } },
      coach: { select: { nama: true } },
    },
  });

  return (
    <div className="anim-fade-up mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Penilaian Perkembangan</h1>
          <p className="mt-1 text-sm text-slate-500">
            {u.role === "SENSEI"
              ? "Nilai perkembangan siswa dojo Anda per periode."
              : "Rekap penilaian sensei (baca saja)."}
          </p>
        </div>
        {u.role === "ADMIN" && (
          <Link
            href="/dashboard/pengaturan/penilaian"
            className="rounded-xl px-5 py-2.5 font-bold text-dojo-700 ring-1 ring-dojo-700/30"
          >
            Pengaturan Skala
          </Link>
        )}
      </div>

      {u.role === "SENSEI" && (
        <div className="mb-8">
          <PenilaianForm siswaList={siswaList} skala={skala} />
        </div>
      )}

      <form className="mb-4 flex gap-2">
        <select
          name="siswa"
          defaultValue={q.siswa ?? ""}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Semua siswa</option>
          {siswaList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama} ({s.memberId})
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {riwayat.map((p) => {
          const nilai: Record<string, number | null | undefined> = {};
          for (const a of ASPEK_PENILAIAN) nilai[a.key] = p[a.key as keyof typeof p] as number | null;
          const rata = rataRata(nilai);
          return (
            <details
              key={p.id}
              className="rounded-2xl bg-white ring-1 ring-slate-200"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div>
                  <p className="font-bold">
                    {p.student.nama}{" "}
                    <span className="font-normal text-slate-500">({p.student.memberId})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Periode {p.periode} · oleh {p.coach.nama} ·{" "}
                    {formatTanggal(p.tanggal)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {rata != null && (
                    <span className="rounded-full bg-dojo-700/10 px-3 py-1 text-sm font-extrabold text-dojo-700">
                      {skala === "LABEL" ? tampilNilai(Math.round(rata), skala) : rata}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">Lihat detail</span>
                </div>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ASPEK_PENILAIAN.map((a) => (
                    <div key={a.key} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                      <p className="text-xs text-slate-500">{a.label}</p>
                      <p className="font-bold">{tampilNilai(nilai[a.key], skala)}</p>
                    </div>
                  ))}
                </div>
                {p.catatan && (
                  <p className="mt-3 text-sm text-slate-600">
                    <span className="font-semibold">Catatan sensei:</span> {p.catatan}
                  </p>
                )}
                {u.role === "SENSEI" && (
                  <PenilaianRow id={p.id} />
                )}
              </div>
            </details>
          );
        })}
        {riwayat.length === 0 && (
          <p className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada penilaian.
          </p>
        )}
      </div>
    </div>
  );
}
