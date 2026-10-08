import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { TransaksiForm } from "@/components/TransaksiForm";
import { keTanggalInput } from "@/lib/format";

export default async function UbahPengeluaranPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await wajibRole("ADMIN");
  const { id } = await params;

  const data = await prisma.expense.findUnique({ where: { id } });
  if (!data) notFound();
  if (u.scopeDojoId && data.dojoId !== u.scopeDojoId) notFound();

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
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Ubah Pengeluaran</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">{data.deskripsi}</p>
      <TransaksiForm
        jenis="pengeluaran"
        mode="ubah"
        transaksiId={data.id}
        awal={{
          tanggal: keTanggalInput(data.tanggal),
          kategoriId: data.kategoriId,
          deskripsi: data.deskripsi,
          nominal: data.nominal,
          dojoId: data.dojoId,
          catatan: data.catatan,
          buktiUrl: data.buktiUrl,
        }}
        dojoList={dojoList}
        kategoriList={kategoriList}
        dojoTerkunci={u.scopeDojoId}
      />
    </div>
  );
}
