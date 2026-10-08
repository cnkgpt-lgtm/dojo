import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { LokasiDojoForm } from "@/components/LokasiDojoForm";

/**
 * Pengaturan titik + radius absensi per dojo (khusus admin).
 * Siswa hanya bisa absen di dalam radius dari titik yang ditandai di sini.
 */
export default async function LokasiPage() {
  const u = await wajibRole("ADMIN");
  const dojos = await prisma.dojo.findMany({
    where: u.scopeDojoId ? { id: u.scopeDojoId } : {},
    orderBy: { nama: "asc" },
    select: {
      id: true,
      nama: true,
      alamat: true,
      latitude: true,
      longitude: true,
      radiusAbsensi: true,
    },
  });

  return (
    <div className="anim-fade-up">
      <div className="mb-5">
        <h1 className="brutal-title text-2xl">LOKASI ABSENSI</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Tandai titik latihan tiap dojo dan atur radiusnya. Siswa hanya bisa melakukan absensi
          mandiri bila berada di dalam radius tersebut — di luar itu aplikasi menolak dengan pesan
          "Anda berada di luar area latihan."
        </p>
      </div>

      {dojos.length === 0 ? (
        <p className="brutal-card p-6 text-sm text-slate-500">
          Belum ada dojo terdaftar.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {dojos.map((d) => (
            <LokasiDojoForm key={d.id} dojo={d} />
          ))}
        </div>
      )}
    </div>
  );
}
