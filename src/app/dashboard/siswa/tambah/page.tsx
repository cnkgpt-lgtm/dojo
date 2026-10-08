import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { SiswaForm } from "@/components/SiswaForm";

export default async function TambahSiswaPage() {
  const u = await wajibRole("ADMIN");

  const [dojoList, sabukList] = await Promise.all([
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
    prisma.belt.findMany({
      where: { isActive: true },
      orderBy: { urutan: "asc" },
      select: { id: true, nama: true },
    }),
  ]);

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/siswa"
        className="brutal-btn brutal-btn-light mb-4"
      >
        Kembali ke daftar siswa
      </Link>
      <h1 className="brutal-title text-2xl uppercase">Tambah Siswa</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Member ID dibuat otomatis oleh sistem dengan format KRT-XXXXXX.
      </p>
      <SiswaForm mode="tambah" dojoList={dojoList} sabukList={sabukList} />
    </div>
  );
}
