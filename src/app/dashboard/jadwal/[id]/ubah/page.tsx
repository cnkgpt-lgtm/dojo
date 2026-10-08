import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { JadwalForm, type JadwalAwal } from "@/components/JadwalForm";

export default async function UbahJadwalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibRole("ADMIN");
  const { id } = await params;

  const jadwal = await prisma.schedule.findUnique({ where: { id } });
  if (!jadwal) notFound();
  if (u.scopeDojoId && jadwal.dojoId !== u.scopeDojoId) notFound();

  const [dojoList, coachList] = await Promise.all([
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
    prisma.coach.findMany({
      where: {
        isActive: true,
        ...(u.scopeDojoId ? { dojoId: u.scopeDojoId } : {}),
      },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, dojoId: true },
    }),
  ]);

  const awal: JadwalAwal = {
    dojoId: jadwal.dojoId,
    hari: jadwal.hari,
    jamMulai: jadwal.jamMulai,
    jamSelesai: jadwal.jamSelesai,
    coachId: jadwal.coachId,
    namaLatihan: jadwal.namaLatihan,
    toleransiMenit: jadwal.toleransiMenit,
    isActive: jadwal.isActive,
  };

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/jadwal"
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali ke daftar jadwal
      </Link>
      <h1 className="brutal-title text-2xl">UBAH JADWAL LATIHAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">{jadwal.namaLatihan}</p>
      <JadwalForm
        mode="ubah"
        jadwalId={jadwal.id}
        awal={awal}
        dojoList={dojoList}
        coachList={coachList}
      />
    </div>
  );
}
