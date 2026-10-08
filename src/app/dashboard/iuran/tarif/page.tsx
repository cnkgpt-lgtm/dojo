import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { TarifManager } from "@/components/TarifManager";

export default async function TarifPage() {
  const u = await wajibRole("ADMIN");

  const [tarif, dojoList, siswaList] = await Promise.all([
    prisma.feeSetting.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      where: u.scopeDojoId
        ? { OR: [{ dojoId: u.scopeDojoId }, { dojoId: null }] }
        : {},
      include: {
        dojo: { select: { id: true, nama: true } },
        student: { select: { id: true, nama: true, memberId: true } },
      },
    }),
    prisma.dojo.findMany({
      where: { isActive: true, ...(u.scopeDojoId ? { id: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true },
    }),
    prisma.student.findMany({
      where: { status: "AKTIF", ...(u.scopeDojoId ? { dojoId: u.scopeDojoId } : {}) },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, memberId: true, dojo: { select: { nama: true } } },
    }),
  ]);

  return (
    <div className="anim-fade-up mx-auto max-w-4xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Tarif Iuran</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Tarif fleksibel: khusus siswa, per dojo, atau default organisasi. Prioritas: siswa &gt; dojo &gt; default.
      </p>
      <TarifManager tarifAwal={tarif} dojoList={dojoList} siswaList={siswaList} />
    </div>
  );
}
