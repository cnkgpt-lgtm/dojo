import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { sekarangMakassar } from "@/lib/absensi";
import { NAMA_HARI, LABEL_STATUS_ABSENSI, WARNA_STATUS_ABSENSI, formatTanggal } from "@/lib/format";

type SearchParams = { bulan?: string };

/** Halaman riwayat kehadiran milik siswa (§16, §23 riwayat absensi). */
export default async function RiwayatAbsensiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const u = await wajibRole("SISWA");
  if (!u.studentId) redirect("/dashboard/profil");
  const sp = await searchParams;

  const w = sekarangMakassar();
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : w.tanggalStr.slice(0, 7);
  const [y, m] = bulan.split("-").map(Number);
  const awal = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  const akhir = new Date(Date.UTC(y, m, 1, 12, 0, 0));

  const data = await prisma.attendance.findMany({
    where: { studentId: u.studentId, tanggal: { gte: awal, lt: akhir } },
    orderBy: [{ tanggal: "desc" }, { jam: "desc" }],
    include: {
      schedule: { select: { namaLatihan: true, hari: true, jamMulai: true, jamSelesai: true } },
      dojo: { select: { nama: true } },
      location: { select: { jarakMeter: true } },
    },
  });

  const jumlahHadir = data.filter((a) => a.status === "HADIR").length;
  const jumlahTerlambat = data.filter((a) => a.status === "TERLAMBAT").length;

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Riwayat Kehadiran</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Kehadiran Anda: {jumlahHadir} hadir, {jumlahTerlambat} terlambat.
      </p>

      <form method="GET" className="mb-4 flex gap-2">
        <input
          type="month"
          name="bulan"
          defaultValue={bulan}
          aria-label="Filter bulan"
          className="rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-dojo-700"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-xl bg-dojo-700 px-4 text-sm font-bold text-white"
        >
          Tampilkan
        </button>
      </form>

      {data.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          Belum ada data kehadiran pada bulan ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((a) => (
            <li key={a.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{a.schedule.namaLatihan}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {NAMA_HARI[a.schedule.hari]}, {formatTanggal(a.tanggal)} ·{" "}
                    {a.schedule.jamMulai}–{a.schedule.jamSelesai}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.dojo.nama}
                    {a.location ? ` · ${a.location.jarakMeter} m dari dojo` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${WARNA_STATUS_ABSENSI[a.status]}`}
                >
                  {LABEL_STATUS_ABSENSI[a.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
