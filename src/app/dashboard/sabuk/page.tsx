import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { SabukManager } from "@/components/SabukManager";

export default async function SabukPage() {
  await wajibRole("ADMIN");

  const daftar = await prisma.belt.findMany({ orderBy: { urutan: "asc" } });

  return (
    <div className="anim-fade-up mx-auto max-w-4xl">
      <h1 className="brutal-title text-2xl">TINGKATAN SABUK</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Urutan sabuk dapat dikonfigurasi. Urutan menentukan validasi kenaikan (§33).
      </p>
      <SabukManager sabukAwal={daftar} />
    </div>
  );
}
