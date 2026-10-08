import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { JadwalForm } from "@/components/JadwalForm";

export default async function TambahJadwalPage() {
  const u = await wajibRole("ADMIN");

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

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/jadwal"
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali ke daftar jadwal
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Tambah Jadwal Latihan</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Tentukan hari, jam, dan sensei pengajar untuk setiap sesi latihan.
      </p>
      <JadwalForm mode="tambah" awal={{}} dojoList={dojoList} coachList={coachList} />
    </div>
  );
}
