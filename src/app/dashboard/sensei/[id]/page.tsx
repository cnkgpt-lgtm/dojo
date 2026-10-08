import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { wajibRole } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { HapusButton } from "@/components/HapusButton";

const NAMA_HARI: Record<string, string> = {
  SENIN: "Senin",
  SELASA: "Selasa",
  RABU: "Rabu",
  KAMIS: "Kamis",
  JUMAT: "Jumat",
  SABTU: "Sabtu",
  MINGGU: "Minggu",
};

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{nilai}</p>
    </div>
  );
}

export default async function DetailSenseiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const { id } = await params;

  const c = await prisma.coach.findUnique({
    where: { id },
    include: {
      dojo: { select: { id: true, nama: true } },
      schedules: {
        where: { isActive: true },
        select: { id: true, namaLatihan: true, hari: true, jamMulai: true, jamSelesai: true },
        orderBy: { jamMulai: "asc" },
      },
    },
  });
  if (!c) redirect("/dashboard/sensei");

  if (u.role === "ADMIN" && u.scopeDojoId && c.dojoId !== u.scopeDojoId) redirect("/dashboard/sensei");
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!c.dojoId || !ids.includes(c.dojoId)) redirect("/dashboard/sensei");
  }

  const bolehKelola = u.role === "ADMIN";

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <Link
        href="/dashboard/sensei"
        className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-slate-600"
      >
        Kembali ke daftar sensei
      </Link>

      <section aria-label="Identitas sensei" className="rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-2xl font-extrabold text-slate-400 ring-1 ring-slate-200"
          >
            {c.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.foto} alt="" className="h-full w-full object-cover" />
            ) : (
              c.nama.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{c.nama}</h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                  c.isActive
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200"
                }`}
              >
                {c.isActive ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {c.dojo?.nama ?? "Tanpa dojo tetap"}
              {c.spesialisasi ? ` · ${c.spesialisasi}` : ""}
            </p>
          </div>
        </div>
        {bolehKelola && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/sensei/${c.id}/ubah`}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-dojo-700 px-5 text-sm font-semibold text-white"
            >
              Ubah Data
            </Link>
            <HapusButton nama={`sensei ${c.nama}`} endpoint={`/api/sensei/${c.id}`} kembaliKe="/dashboard/sensei" />
          </div>
        )}
      </section>

      <section aria-label="Data lengkap" className="mt-6 rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-x-8 px-6 sm:grid-cols-2">
          <div className="divide-y divide-slate-100">
            <Baris label="Nomor HP" nilai={c.phone ?? "-"} />
            <Baris label="Email" nilai={c.email ?? "-"} />
            <Baris label="Alamat" nilai={c.alamat ?? "-"} />
          </div>
          <div className="divide-y divide-slate-100">
            <Baris label="Nomor identitas / member" nilai={c.nomorIdentitas ?? "-"} />
            <Baris label="Spesialisasi" nilai={c.spesialisasi ?? "-"} />
            <Baris label="Dojo" nilai={c.dojo?.nama ?? "-"} />
          </div>
        </div>
      </section>

      <section aria-label="Jadwal yang ditugaskan" className="mt-6">
        <h2 className="mb-3 text-base font-bold">Jadwal Latihan</h2>
        {c.schedules.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada jadwal yang ditugaskan. Penugasan dilakukan di modul jadwal.
          </p>
        ) : (
          <ul className="space-y-2">
            {c.schedules.map((j) => (
              <li key={j.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="font-semibold">{j.namaLatihan}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {NAMA_HARI[j.hari] ?? j.hari} · {j.jamMulai}–{j.jamSelesai}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
