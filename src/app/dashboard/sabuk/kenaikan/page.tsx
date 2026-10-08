import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { KenaikanForm } from "@/components/KenaikanForm";

export default async function KenaikanSabukPage() {
  const u = await wajibRole("ADMIN", "SENSEI");

  const whereSiswa =
    u.role === "ADMIN" && u.scopeDojoId
      ? { status: "AKTIF" as const, dojoId: u.scopeDojoId }
      : u.role === "SENSEI"
        ? { status: "AKTIF" as const, dojoId: { in: await dojoIdsUntukSensei(u.coachId) } }
        : { status: "AKTIF" as const };

  const [siswaList, sabukList] = await Promise.all([
    prisma.student.findMany({
      where: whereSiswa,
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        memberId: true,
        sabuk: { select: { nama: true, urutan: true } },
      },
    }),
    prisma.belt.findMany({ where: { isActive: true }, orderBy: { urutan: "asc" } }),
  ]);

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <h1 className="brutal-title text-2xl">CATAT KENAIKAN SABUK</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Sabuk baru harus lebih tinggi dari sabuk saat ini. Kenaikan lebih dari satu tingkat hanya
        dapat dicatat admin dan wajib disertai keterangan.
      </p>
      <KenaikanForm siswaList={siswaList} sabukList={sabukList} />
    </div>
  );
}
