import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { SenseiForm } from "@/components/SenseiForm";

export default async function UbahSenseiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibRole("ADMIN");
  const { id } = await params;

  const c = await prisma.coach.findUnique({ where: { id } });
  if (!c) redirect("/dashboard/sensei");
  if (u.scopeDojoId && c.dojoId !== u.scopeDojoId) redirect("/dashboard/sensei");

  const dojoList = await prisma.dojo.findMany({
    where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href={`/dashboard/sensei/${c.id}`}
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali ke detail sensei
      </Link>
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Ubah Data Sensei</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">{c.nama}</p>
      <SenseiForm
        mode="ubah"
        coachId={c.id}
        awal={{
          nama: c.nama,
          foto: c.foto,
          dojoId: c.dojoId,
          phone: c.phone,
          email: c.email,
          alamat: c.alamat,
          nomorIdentitas: c.nomorIdentitas,
          spesialisasi: c.spesialisasi,
          isActive: c.isActive,
        }}
        dojoList={dojoList}
      />
    </div>
  );
}
