import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { PenilaianForm } from "@/components/PenilaianForm";
import { getSkalaPenilaian } from "@/lib/sabuk";

export default async function UbahPenilaianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibRole("SENSEI");
  const { id } = await params;

  const data = await prisma.studentAssessment.findUnique({
    where: { id },
    include: { student: { select: { id: true, nama: true, memberId: true } } },
  });
  if (!data || data.coachId !== u.coachId) redirect("/dashboard/penilaian");

  const skala = await getSkalaPenilaian();

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <h1 className="brutal-title text-2xl">UBAH PENILAIAN</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {data.student.nama} ({data.student.memberId}) · Periode {data.periode}
      </p>
      <PenilaianForm
        siswaList={[
          { id: data.student.id, nama: data.student.nama, memberId: data.student.memberId },
        ]}
        skala={skala}
        editAwal={{
          id: data.id,
          studentId: data.studentId,
          periode: data.periode,
          catatan: data.catatan,
          kihon: data.kihon,
          kata: data.kata,
          kumite: data.kumite,
          fisik: data.fisik,
          disiplin: data.disiplin,
          sikap: data.sikap,
          kehadiran: data.kehadiran,
          teknik: data.teknik,
        }}
      />
    </div>
  );
}
