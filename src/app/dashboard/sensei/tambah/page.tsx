import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { SenseiForm } from "@/components/SenseiForm";

export default async function TambahSenseiPage() {
  const u = await wajibRole("ADMIN");

  const dojoList = await prisma.dojo.findMany({
    where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/sensei"
        className="brutal-btn brutal-btn-light mb-4"
      >
        Kembali ke daftar sensei
      </Link>
      <h1 className="brutal-title text-2xl uppercase">Tambah Sensei</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Data pelatih sesuai field PRD. Penugasan jadwal dilakukan di modul jadwal.
      </p>
      <SenseiForm mode="tambah" dojoList={dojoList} />
    </div>
  );
}
