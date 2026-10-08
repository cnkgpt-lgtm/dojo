import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { TransaksiForm } from "@/components/TransaksiForm";
import { keTanggalInput } from "@/lib/format";

export default async function UbahPemasukanPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await wajibRole("ADMIN");
  const { id } = await params;

  const data = await prisma.revenue.findUnique({ where: { id } });
  if (!data) notFound();
  if (u.scopeDojoId && data.dojoId !== u.scopeDojoId) notFound();
  // Entri otomatis dari pembayaran iuran tidak boleh diubah (§49).
  if (data.paymentId) notFound();

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
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Ubah Pemasukan</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">{data.deskripsi}</p>
      <TransaksiForm
        jenis="pemasukan"
        mode="ubah"
        transaksiId={data.id}
        awal={{
          tanggal: keTanggalInput(data.tanggal),
          kategoriId: data.kategoriId,
          deskripsi: data.deskripsi,
          nominal: data.nominal,
          metode: data.metode,
          dojoId: data.dojoId,
          buktiUrl: data.buktiUrl,
        }}
        dojoList={dojoList}
        kategoriList={kategoriList}
        dojoTerkunci={u.scopeDojoId}
      />
    </div>
  );
}
