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
      <h1 className="brutal-title text-2xl">RIWAYAT KEHADIRAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Kehadiran Anda: {jumlahHadir} hadir, {jumlahTerlambat} terlambat.
      </p>

      <form method="GET" className="mb-4 flex gap-2">
        <input
          type="month"
          name="bulan"
          defaultValue={bulan}
          aria-label="Filter bulan"
          className="brutal-input sm:w-auto"
        />
        <button type="submit" className="brutal-btn brutal-btn-primary">
          Tampilkan
        </button>
      </form>

      {data.length === 0 ? (
        <p className="brutal-card p-6 text-sm text-slate-500">
          Belum ada data kehadiran pada bulan ini.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((a) => (
            <li key={a.id} className="brutal-card p-4">
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
                <span className={`brutal-badge ${WARNA_STATUS_ABSENSI[a.status]}`}>
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
