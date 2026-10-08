import { wajibRole } from "@/lib/authz";
import { getSkalaPenilaian } from "@/lib/sabuk";
import { SkalaForm } from "@/components/SkalaForm";

export default async function PengaturanPenilaianPage() {
  await wajibRole("ADMIN");
  const skala = await getSkalaPenilaian();

  return (
    <div className="anim-fade-up mx-auto max-w-2xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Pengaturan Penilaian</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Pilih sistem skala yang dipakai sensei saat menilai perkembangan siswa (§35).
      </p>
      <SkalaForm skalaAwal={skala} />
    </div>
  );
}
