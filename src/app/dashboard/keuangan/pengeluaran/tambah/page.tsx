import Link from "next/link";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { TransaksiForm } from "@/components/TransaksiForm";

export default async function TambahPengeluaranPage() {
  const u = await wajibRole("ADMIN");
  const [dojoList, kategoriList] = await Promise.all([
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
  ]);

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link href="/dashboard/keuangan/pengeluaran" className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600">
        Kembali ke daftar pengeluaran
      </Link>
      <h1 className="brutal-title text-2xl">CATAT PENGELUARAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Setiap pengeluaran tercatat dengan petugas dan masuk audit log.
      </p>
      <TransaksiForm
        jenis="pengeluaran"
        mode="tambah"
        awal={{}}
        dojoList={dojoList}
        kategoriList={kategoriList}
        dojoTerkunci={u.scopeDojoId}
      />
    </div>
  );
}
