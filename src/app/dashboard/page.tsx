import { wajibLogin } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { DayOfWeek } from "@prisma/client";
import Link from "next/link";
import { sekarangMakassar, menitDariJam } from "@/lib/absensi";
import { ringkasanAdmin } from "@/lib/dashboard";
import { tanggalMakassar } from "@/lib/keuangan";

function rupiah(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}

function StatCard({ label, nilai, catatan }: { label: string; nilai: string; catatan?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{nilai}</p>
      {catatan && <p className="mt-1 text-xs text-slate-500">{catatan}</p>}
    </div>
  );
}

const NAMA_HARI: Record<DayOfWeek, string> = {
  SENIN: "Senin",
  SELASA: "Selasa",
  RABU: "Rabu",
  KAMIS: "Kamis",
  JUMAT: "Jumat",
  SABTU: "Sabtu",
  MINGGU: "Minggu",
};

function hariIni(): DayOfWeek {
  // Zona Asia/Makassar (WITA), mengikuti konvensi proyek lain
  const nama = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Makassar",
  }).format(new Date());
  const peta: Record<string, DayOfWeek> = {
    Senin: "SENIN",
    Selasa: "SELASA",
    Rabu: "RABU",
    Kamis: "KAMIS",
    Jumat: "JUMAT",
    Sabtu: "SABTU",
    Minggu: "MINGGU",
  };
  return peta[nama] ?? "SENIN";
}

async function DashboardAdmin({ scopeDojoId }: { scopeDojoId: string | null }) {
  // Ringkasan live (§37): agregasi efisien satu panggilan, mengikuti scope dojo.
  const r = await ringkasanAdmin(scopeDojoId);
  return (
    <div className="space-y-6">
      <section aria-label="Statistik dojo" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total Siswa" nilai={String(r.totalSiswa)} catatan="Siswa aktif" />
        <StatCard label="Total Dojo" nilai={String(r.totalDojo)} catatan="Dojo aktif" />
        <StatCard label="Total Sensei" nilai={String(r.totalSensei)} catatan="Sensei aktif" />
        <StatCard label="Kehadiran Hari Ini" nilai={String(r.kehadiranHariIni)} catatan="Absensi tercatat" />
        <StatCard
          label="Pembayaran Hari Ini"
          nilai={rupiah(r.pembayaranHariIni.nominal)}
          catatan={`${r.pembayaranHariIni.jumlah} pembayaran lunas`}
        />
        <StatCard label="Menunggu Verifikasi" nilai={String(r.menungguVerifikasi)} catatan="Pembayaran transfer" />
        <StatCard label="Total Pemasukan" nilai={rupiah(r.totalPemasukan)} catatan="Semua waktu" />
        <StatCard label="Total Pengeluaran" nilai={rupiah(r.totalPengeluaran)} catatan="Semua waktu" />
        <StatCard label="Saldo Kas" nilai={rupiah(r.saldo)} catatan="Pemasukan dikurangi pengeluaran" />
        <StatCard
          label="Total Tunggakan"
          nilai={rupiah(r.totalTunggakan.nominal)}
          catatan={`${r.totalTunggakan.jumlah} tagihan belum bayar`}
        />
      </section>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/keuangan" className="inline-flex min-h-[48px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-bold text-white">
          Kelola Keuangan
        </Link>
        <Link href="/dashboard/laporan" className="inline-flex min-h-[48px] items-center rounded-xl px-5 text-sm font-bold text-dojo-700 ring-1 ring-slate-200">
          Lihat Laporan
        </Link>
      </div>
    </div>
  );
}

async function DashboardSensei({ coachId }: { coachId: string | null }) {
  const coach = coachId
    ? await prisma.coach.findUnique({ where: { id: coachId }, include: { dojo: true } })
    : null;
  const dojoId = coach?.dojoId ?? undefined;
  const [y, m, d] = tanggalMakassar().split("-").map(Number);
  const tanggalKalender = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const [jumlahSiswa, jadwalHariIni, absensiHariIni] = await Promise.all([
    prisma.student.count({ where: { status: "AKTIF", ...(dojoId ? { dojoId } : {}) } }),
    prisma.schedule.findMany({
      where: { isActive: true, hari: hariIni(), ...(dojoId ? { dojoId } : {}) },
      include: { dojo: true },
      orderBy: { jamMulai: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        tanggal: tanggalKalender,
        ...(dojoId ? { dojoId } : {}),
        status: { in: ["HADIR", "TERLAMBAT"] },
      },
      select: { scheduleId: true },
    }),
  ]);
  const hadirPerJadwal = new Map<string, number>();
  for (const a of absensiHariIni) {
    hadirPerJadwal.set(a.scheduleId, (hadirPerJadwal.get(a.scheduleId) ?? 0) + 1);
  }
  const totalHadir = absensiHariIni.length;
  return (
    <div className="space-y-6">
      <section aria-label="Statistik latihan" className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Jumlah Siswa" nilai={String(jumlahSiswa)} catatan={coach?.dojo?.nama ?? "Semua dojo"} />
        <StatCard label="Jadwal Hari Ini" nilai={String(jadwalHariIni.length)} catatan={NAMA_HARI[hariIni()]} />
        <StatCard label="Siswa Hadir" nilai={String(totalHadir)} catatan="Absensi hari ini" />
        <StatCard label="Siswa Tidak Hadir" nilai={String(Math.max(0, jumlahSiswa - totalHadir))} catatan="Aktif dikurangi hadir" />
      </section>
      <section aria-label="Jadwal hari ini">
        <h2 className="mb-3 text-base font-bold">Jadwal Hari Ini</h2>
        {jadwalHariIni.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
            Tidak ada jadwal latihan hari ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {jadwalHariIni.map((j) => (
              <li key={j.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="font-semibold">{j.namaLatihan}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {j.jamMulai}–{j.jamSelesai} · {j.dojo.nama}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-semibold text-emerald-700">{hadirPerJadwal.get(j.id) ?? 0} hadir</span>
                  <span className="text-slate-400"> dari {jumlahSiswa} siswa aktif</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const URUTAN_HARI: DayOfWeek[] = [
  "SENIN",
  "SELASA",
  "RABU",
  "KAMIS",
  "JUMAT",
  "SABTU",
  "MINGGU",
];

/** Jadwal aktif terdekat dari sekarang (zona Asia/Makassar). */
function cariJadwalBerikutnya(
  jadwals: { hari: DayOfWeek; jamMulai: string; namaLatihan: string; coach: { nama: string } | null }[]
): { jadwal: (typeof jadwals)[number]; offsetHari: number } | null {
  const w = sekarangMakassar();
  const idxHari = URUTAN_HARI.indexOf(w.hari);
  for (let off = 0; off < 7; off++) {
    const hari = URUTAN_HARI[(idxHari + off) % 7];
    const kandidat = jadwals
      .filter((j) => j.hari === hari)
      .filter((j) => off > 0 || menitDariJam(j.jamMulai) > w.menit)
      .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
    if (kandidat.length > 0) return { jadwal: kandidat[0], offsetHari: off };
  }
  return null;
}

async function DashboardSiswa({ studentId }: { studentId: string | null }) {
  const siswa = studentId
    ? await prisma.student.findUnique({
        where: { id: studentId },
        include: { dojo: true, sabuk: true },
      })
    : null;
  const semuaJadwal = siswa
    ? await prisma.schedule.findMany({
        where: { isActive: true, dojoId: siswa.dojoId },
        include: { coach: true },
      })
    : [];
  const jadwalBerikutnya = cariJadwalBerikutnya(semuaJadwal);
  const daftarJadwal = [...semuaJadwal]
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
    .slice(0, 3);
  // Ringkasan iuran Phase 4 (§24, §64): tagihan terbuka + total tunggakan.
  const tagihanTerbuka = studentId
    ? await prisma.invoice.findMany({
        where: { studentId, status: { in: ["BELUM_BAYAR", "DITOLAK"] } },
        select: { nominal: true },
      })
    : [];
  return (
    <div className="space-y-6">
      <section
        aria-label="Profil siswa"
        className="flex items-center gap-4 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200"
      >
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-dojo-700 text-lg font-extrabold text-white"
        >
          {siswa ? siswa.nama.charAt(0).toUpperCase() : "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{siswa?.nama ?? "Profil belum terhubung"}</p>
          <p className="text-sm text-slate-500">
            {siswa ? `${siswa.memberId} · ${siswa.dojo.nama}` : "Hubungi admin dojo Anda"}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold">Sabuk:</span>{" "}
            <span className="text-slate-600">{siswa?.sabuk?.nama ?? "Belum ada"}</span>
          </p>
        </div>
      </section>

      <section aria-label="Jadwal berikutnya">
        <h2 className="mb-3 text-base font-bold">Jadwal Berikutnya</h2>
        {jadwalBerikutnya ? (
          <div className="rounded-2xl bg-dojo-700 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-100">
              {jadwalBerikutnya.offsetHari === 0
                ? "Hari ini"
                : `${NAMA_HARI[jadwalBerikutnya.jadwal.hari]}`}
            </p>
            <p className="mt-1 text-lg font-extrabold">
              {jadwalBerikutnya.jadwal.jamMulai} · {jadwalBerikutnya.jadwal.namaLatihan}
            </p>
            {jadwalBerikutnya.jadwal.coach && (
              <p className="mt-0.5 text-sm text-red-100">
                Sensei {jadwalBerikutnya.jadwal.coach.nama}
              </p>
            )}
            <Link
              href="/dashboard/absensi"
              className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-white text-base font-extrabold text-dojo-700"
            >
              ABSEN SEKARANG
            </Link>
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada jadwal latihan berikutnya.
          </p>
        )}
      </section>

      <section aria-label="Jadwal latihan">
        <h2 className="mb-3 text-base font-bold">Jadwal Latihan</h2>
        {daftarJadwal.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada jadwal latihan.
          </p>
        ) : (
          <ul className="space-y-2">
            {daftarJadwal.map((j) => (
              <li key={j.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="font-semibold">
                  {NAMA_HARI[j.hari]} · {j.jamMulai}–{j.jamSelesai}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {j.namaLatihan}
                  {j.coach ? ` · Sensei ${j.coach.nama}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Iuran" className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label="Tagihan Aktif"
          nilai={String(tagihanTerbuka.length)}
          catatan="Belum dibayar"
        />
        <StatCard
          label="Tunggakan"
          nilai={rupiah(tagihanTerbuka.reduce((s, t) => s + t.nominal, 0))}
          catatan="Total menunggak"
        />
      </section>
      <Link
        href="/dashboard/iuran"
        className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white"
      >
        Lihat & Bayar Iuran
      </Link>
    </div>
  );
}

const JUDUL: Record<string, { sapaan: string; deskripsi: string }> = {
  ADMIN: {
    sapaan: "Ringkasan Operasional",
    deskripsi: "Pantau seluruh dojo, siswa, dan keuangan organisasi dalam satu layar.",
  },
  SENSEI: {
    sapaan: "Ringkasan Latihan",
    deskripsi: "Jadwal hari ini, daftar siswa, dan kehadiran dojo Anda.",
  },
  SISWA: {
    sapaan: "Ringkasan Saya",
    deskripsi: "Jadwal latihan, profil, dan status iuran Anda.",
  },
};

export default async function DashboardPage() {
  const u = await wajibLogin();
  const judul = JUDUL[u.role];

  return (
    <div className="anim-fade-up">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{judul.sapaan}</h1>
        <p className="mt-1 text-sm text-slate-500">{judul.deskripsi}</p>
      </div>

      {u.role === "ADMIN" && <DashboardAdmin scopeDojoId={u.scopeDojoId} />}
      {u.role === "SENSEI" && <DashboardSensei coachId={u.coachId} />}
      {u.role === "SISWA" && <DashboardSiswa studentId={u.studentId} />}
    </div>
  );
}
