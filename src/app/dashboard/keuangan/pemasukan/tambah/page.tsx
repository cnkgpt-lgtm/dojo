import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { TransaksiForm } from "@/components/TransaksiForm";

export default async function TambahPemasukanPage() {
  const u = await wajibRole("ADMIN");
  const [dojoList, kategoriList] = await Promise.all([
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
    prisma.revenueCategory.findMany({
      where: { isActive: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ]);

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link href="/dashboard/keuangan/pemasukan" className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600">
        Kembali ke daftar pemasukan
      </Link>
      <h1 className="brutal-title text-2xl">CATAT PEMASUKAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Pemasukan iuran dari pembayaran siswa tercatat otomatis — form ini untuk pemasukan lain (pendaftaran, ujian, kegiatan, dst).
      </p>
      <TransaksiForm
        jenis="pemasukan"
        mode="tambah"
        awal={{}}
        dojoList={dojoList}
        kategoriList={kategoriList}
        dojoTerkunci={u.scopeDojoId}
      />
    </div>
  );
}
