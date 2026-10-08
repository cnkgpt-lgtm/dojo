import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { sekarangMakassar, statusJendela, menitDariJam } from "@/lib/absensi";
import { NAMA_HARI } from "@/lib/format";
import { AbsensiClient } from "@/components/AbsensiClient";

/** Halaman absensi siswa (§63): jadwal aktif hari ini + selfie + GPS. */
export default async function AbsensiPage() {
  const u = await wajibRole("SISWA");
  if (!u.studentId) redirect("/dashboard/profil");

  const siswa = await prisma.student.findUnique({
    where: { id: u.studentId },
    include: { dojo: true },
  });
  if (!siswa) redirect("/dashboard/profil");

  const w = sekarangMakassar();
  const jadwalHariIni = await prisma.schedule.findMany({
    where: { isActive: true, dojoId: siswa.dojoId, hari: w.hari },
    include: { coach: { select: { nama: true } } },
    orderBy: { jamMulai: "asc" },
  });

  const jadwal = jadwalHariIni.map((j) => {
    const jendela = statusJendela(j.jamMulai, j.jamSelesai, j.toleransiMenit, w.menit);
    const bukaMenit = menitDariJam(j.jamMulai) - j.toleransiMenit;
    const jamBuka = `${String(Math.floor(Math.max(0, bukaMenit) / 60)).padStart(2, "0")}:${String(
      Math.max(0, bukaMenit) % 60
    ).padStart(2, "0")}`;
    return {
      id: j.id,
      namaLatihan: j.namaLatihan,
      jamMulai: j.jamMulai,
      jamSelesai: j.jamSelesai,
      jamBuka,
      coachNama: j.coach?.nama ?? null,
      jendela,
    };
  });

  return (
    <div className="anim-fade-up mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="brutal-title text-2xl">ABSENSI LATIHAN</h1>
        <p className="mt-1 text-sm text-slate-500">
          {NAMA_HARI[w.hari]}, {w.tanggalStr} · {siswa.dojo.nama}
        </p>
      </div>
      <AbsensiClient
        student={{ nama: siswa.nama, foto: siswa.foto, memberId: siswa.memberId }}
        dojo={{
          nama: siswa.dojo.nama,
          latitude: siswa.dojo.latitude,
          longitude: siswa.dojo.longitude,
          radiusAbsensi: siswa.dojo.radiusAbsensi,
        }}
        schedules={jadwal}
      />
    </div>
  );
}
