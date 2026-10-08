import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { PengumumanForm } from "@/components/PengumumanForm";

export default async function UbahPengumumanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibRole("ADMIN");
  const { id } = await params;

  const p = await prisma.announcement.findUnique({ where: { id } });
  if (!p) notFound();
  if (u.scopeDojoId && p.dojoId !== u.scopeDojoId) notFound();

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
      <h1 className="brutal-title text-2xl">UBAH PENGUMUMAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Perbarui isi atau masa tayang pengumuman.</p>
      <PengumumanForm
        mode="ubah"
        pengumumanId={p.id}
        awal={{
          judul: p.judul,
          isi: p.isi,
          target: p.target,
          dojoId: p.dojoId,
          tanggalMulai: p.tanggalMulai?.toISOString() ?? null,
          tanggalSelesai: p.tanggalSelesai?.toISOString() ?? null,
          isActive: p.isActive,
        }}
        dojoList={dojoList}
        targetTerkunciDojo={!!u.scopeDojoId}
      />
    </div>
  );
}
