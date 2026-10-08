import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { PengumumanForm } from "@/components/PengumumanForm";

export default async function TambahPengumumanPage() {
  const u = await wajibRole("ADMIN");

  const dojoList = await prisma.dojo.findMany({
    where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/pengumuman/kelola"
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali ke kelola pengumuman
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Buat Pengumuman</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Tulis kabar yang ingin disampaikan kepada siswa, sensei, atau dojo tertentu.
      </p>
      <PengumumanForm
        mode="tambah"
        awal={{}}
        dojoList={dojoList}
        targetTerkunciDojo={!!u.scopeDojoId}
      />
    </div>
  );
}
