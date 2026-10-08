import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { SiswaForm } from "@/components/SiswaForm";

export default async function UbahSiswaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibRole("ADMIN");
  const { id } = await params;

  const s = await prisma.student.findUnique({ where: { id } });
  if (!s) redirect("/dashboard/siswa");
  if (u.scopeDojoId && s.dojoId !== u.scopeDojoId) redirect("/dashboard/siswa");

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
        href={`/dashboard/siswa/${s.id}`}
        className="brutal-btn brutal-btn-light mb-4"
      >
        Kembali ke detail siswa
      </Link>
      <h1 className="brutal-title text-2xl uppercase">Ubah Data Siswa</h1>
      <p className="mt-1 mb-6 font-mono text-xs text-slate-500">{s.memberId} (tidak dapat diubah)</p>
      <SiswaForm
        mode="ubah"
        studentId={s.id}
        awal={{
          nama: s.nama,
          foto: s.foto,
          phone: s.phone,
          email: s.email,
          alamat: s.alamat,
          tempatLahir: s.tempatLahir,
          tanggalLahir: s.tanggalLahir,
          jenisKelamin: s.jenisKelamin,
          namaOrangTua: s.namaOrangTua,
          phoneOrangTua: s.phoneOrangTua,
          dojoId: s.dojoId,
          tanggalBergabung: s.tanggalBergabung,
          status: s.status,
          sabukId: s.sabukId,
          catatan: s.catatan,
        }}
        dojoList={dojoList}
        sabukList={sabukList}
      />
    </div>
  );
}
