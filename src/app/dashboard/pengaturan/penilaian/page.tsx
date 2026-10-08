import { wajibRole } from "@/lib/authz";
import { getSkalaPenilaian } from "@/lib/sabuk";
import { SkalaForm } from "@/components/SkalaForm";

export default async function PengaturanPenilaianPage() {
  await wajibRole("ADMIN");
  const skala = await getSkalaPenilaian();

  return (
    <div className="anim-fade-up mx-auto max-w-2xl">
      <h1 className="brutal-title text-2xl">PENGATURAN PENILAIAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Pilih sistem skala yang dipakai sensei saat menilai perkembangan siswa (§35).
      </p>
      <SkalaForm skalaAwal={skala} />
    </div>
  );
}
