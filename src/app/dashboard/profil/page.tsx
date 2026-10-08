import { prisma } from "@/lib/db";
import { wajibLogin } from "@/lib/authz";
import { ProfilForm } from "@/components/ProfilForm";
import { StatusBadge } from "@/components/StatusBadge";
import { LABEL_STATUS_SISWA, formatTanggal } from "@/lib/format";

const LABEL_ROLE: Record<string, string> = {
  ADMIN: "Admin",
  SENSEI: "Sensei",
  SISWA: "Siswa",
};

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="py-3">
      <p className="text-xs font-black uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{nilai}</p>
    </div>
  );
}

export default async function ProfilPage() {
  const u = await wajibLogin();

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      scopeDojo: { select: { nama: true } },
    },
  });

  const siswa =
    u.role === "SISWA" && u.studentId
      ? await prisma.student.findUnique({
          where: { id: u.studentId },
          include: {
            dojo: { select: { nama: true } },
            sabuk: { select: { nama: true } },
          },
        })
      : null;

  const sensei =
    u.role === "SENSEI" && u.coachId
      ? await prisma.coach.findUnique({
          where: { id: u.coachId },
          include: { dojo: { select: { nama: true } } },
        })
      : null;

  const foto = siswa?.foto ?? sensei?.foto ?? null;

  // Ringkasan untuk profil siswa (§36)
  const ringkasan =
    siswa != null
      ? await (async () => {
          const [rekapHadir, tunggakan, penilaianTerakhir] = await Promise.all([
            prisma.attendance.groupBy({
              by: ["status"],
              where: { studentId: siswa.id },
              _count: { status: true },
            }),
            prisma.invoice.aggregate({
              where: { studentId: siswa.id, status: { in: ["BELUM_BAYAR", "TERLAMBAT"] } },
              _count: { id: true },
              _sum: { nominal: true },
            }),
            prisma.studentAssessment.findFirst({
              where: { studentId: siswa.id },
              orderBy: { periode: "desc" },
              include: { coach: { select: { nama: true } } },
            }),
          ]);
          return {
            hadir: rekapHadir.find((r) => r.status === "HADIR")?._count.status ?? 0,
            terlambat: rekapHadir.find((r) => r.status === "TERLAMBAT")?._count.status ?? 0,
            tunggakanJml: tunggakan._count.id,
            tunggakanNominal: tunggakan._sum.nominal ?? 0,
            penilaianTerakhir,
          };
        })()
      : null;

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <h1 className="brutal-title text-2xl uppercase">Profil Saya</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {LABEL_ROLE[u.role] ?? u.role}
        {u.role === "ADMIN" && u.scopeDojoId ? ` · ${user?.scopeDojo?.nama ?? "Dojo"}` : ""}
        {u.role === "ADMIN" && !u.scopeDojoId ? " · Pusat" : ""}
      </p>

      <section aria-label="Identitas" className="brutal-card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-black bg-white text-2xl font-extrabold text-slate-400"
          >
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              (user?.name ?? "?").charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="brutal-title text-lg uppercase">{user?.name}</p>
            {siswa && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="brutal-angka text-xs text-slate-500">{siswa.memberId}</span>
                <StatusBadge status={siswa.status} label={LABEL_STATUS_SISWA[siswa.status] ?? siswa.status} />
              </div>
            )}
            <p className="mt-1 text-sm text-slate-600">
              {siswa ? `${siswa.dojo.nama} · Sabuk ${siswa.sabuk?.nama ?? "belum ada"}` : ""}
              {sensei ? `${sensei.dojo?.nama ?? "Tanpa dojo tetap"}` : ""}
            </p>
          </div>
        </div>
      </section>

      {siswa && (
        <section aria-label="Data keanggotaan" className="brutal-card mt-6">
          <div className="grid grid-cols-1 gap-x-8 px-6 sm:grid-cols-2">
            <div className="divide-y divide-black/10">
              <Baris label="Tanggal bergabung" nilai={formatTanggal(siswa.tanggalBergabung)} />
              <Baris label="Dojo" nilai={siswa.dojo.nama} />
            </div>
            <div className="divide-y divide-black/10">
              <Baris label="Sabuk saat ini" nilai={siswa.sabuk?.nama ?? "Belum ada"} />
              <Baris label="Nama orang tua / wali" nilai={siswa.namaOrangTua ?? "-"} />
            </div>
          </div>
        </section>
      )}

      {siswa && ringkasan && (
        <section
          aria-label="Ringkasan saya"
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div className="brutal-card p-5">
            <p className="brutal-title text-base uppercase">Kehadiran</p>
            <p className="mt-2 text-sm text-slate-600">
              <span className="brutal-angka text-dojo-700">{ringkasan.hadir}</span> hadir ·{" "}
              <span className="brutal-angka text-amber-600">{ringkasan.terlambat}</span> terlambat
            </p>
          </div>
          <div className="brutal-card p-5">
            <p className="brutal-title text-base uppercase">Status Iuran</p>
            {ringkasan.tunggakanJml > 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                <span className="brutal-angka text-red-700">{ringkasan.tunggakanJml} tagihan</span>{" "}
                belum dibayar
              </p>
            ) : (
              <p className="mt-2 text-sm font-semibold text-emerald-700">Tidak ada tunggakan.</p>
            )}
          </div>
          <div className="brutal-card p-5">
            <p className="brutal-title text-base uppercase">Perkembangan</p>
            {ringkasan.penilaianTerakhir ? (
              <p className="mt-2 text-sm text-slate-600">
                Penilaian terakhir periode{" "}
                <span className="font-bold">{ringkasan.penilaianTerakhir.periode}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Belum ada penilaian.</p>
            )}
          </div>
        </section>
      )}

      <section aria-label="Ubah profil" className="brutal-card mt-6 p-6">
        <h2 className="brutal-title mb-1 text-lg uppercase">Ubah Profil</h2>
        <p className="mb-5 text-sm text-slate-500">
          {u.role === "ADMIN"
            ? "Anda dapat mengubah nama, nomor HP, dan email akun ini."
            : "Anda dapat mengubah foto, nomor HP, email, dan alamat. Data keanggotaan hanya dapat diubah admin."}
        </p>
        <ProfilForm
          isAdmin={u.role === "ADMIN"}
          awal={{
            name: user?.name ?? "",
            phone: u.role === "ADMIN" ? (user?.phone ?? "") : (siswa?.phone ?? sensei?.phone ?? ""),
            email: u.role === "ADMIN" ? (user?.email ?? "") : (siswa?.email ?? sensei?.email ?? ""),
            foto,
            alamat: siswa?.alamat ?? sensei?.alamat ?? "",
          }}
        />
      </section>
    </div>
  );
}
