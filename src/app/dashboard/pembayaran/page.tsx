import { prisma, Prisma } from "@/lib/db";
import { wajibLogin, wajibRole } from "@/lib/authz";
import { VerifikasiCard } from "@/components/VerifikasiCard";
import { TunaiForm } from "@/components/TunaiForm";
import { BadgeIuran, BadgeMetode } from "@/components/BadgeIuran";
import { rupiah, formatTanggal} from "@/lib/format";
import { labelPeriode } from "@/lib/iuran";

const PER_HALAMAN = 15;

async function PembayaranAdmin({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const u = await wajibLogin();
  const status = searchParams.status ?? "";
  const metode = searchParams.metode ?? "";
  const halaman = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const where: Prisma.PaymentWhereInput = {};
  const STATUS_VALID = ["MENUNGGU_VERIFIKASI", "LUNAS", "DITOLAK"];
  if (status && STATUS_VALID.includes(status))
    where.status = status as Prisma.PaymentWhereInput["status"];
  if (metode === "TUNAI" || metode === "TRANSFER") where.metode = metode;
  if (u.scopeDojoId) where.invoice = { dojoId: u.scopeDojoId };

  const [antrean, total, riwayat, tagihanTerbuka] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "MENUNGGU_VERIFIKASI", ...(u.scopeDojoId ? { invoice: { dojoId: u.scopeDojoId } } : {}) },
      orderBy: { createdAt: "asc" },
      include: {
        student: { select: { nama: true, memberId: true } },
        invoice: { select: { periode: true, nominal: true } },
        proof: { select: { url: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        student: { select: { nama: true, memberId: true } },
        invoice: {
          select: { periode: true, dojo: { select: { nama: true } } },
        },
        petugas: { select: { name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: { in: ["BELUM_BAYAR", "DITOLAK"] },
        ...(u.scopeDojoId ? { dojoId: u.scopeDojoId } : {}),
      },
      orderBy: [{ periode: "desc" }],
      take: 100,
      select: {
        id: true,
        periode: true,
        nominal: true,
        student: { select: { nama: true, memberId: true } },
      },
    }),
  ]);
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  return (
    <div className="space-y-8">
      {/* Antrean verifikasi */}
      <section>
        <h2 className="mb-3 text-base font-bold">
          Menunggu Verifikasi{" "}
          <span className="ml-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            {antrean.length}
          </span>
        </h2>
        {antrean.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Tidak ada pembayaran yang menunggu verifikasi.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {antrean.map((p) => (
              <VerifikasiCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* Tunai */}
      <TunaiForm tagihanList={tagihanTerbuka} />

      {/* Riwayat */}
      <section>
        <h2 className="mb-3 text-base font-bold">Riwayat Pembayaran</h2>
        <form method="get" className="mb-3 flex flex-wrap gap-3">
          <select name="status" defaultValue={status} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">
            <option value="">Semua status</option>
            <option value="MENUNGGU_VERIFIKASI">Menunggu Verifikasi</option>
            <option value="LUNAS">Lunas</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
          <select name="metode" defaultValue={metode} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">
            <option value="">Semua metode</option>
            <option value="TUNAI">Tunai</option>
            <option value="TRANSFER">Transfer</option>
          </select>
          <button className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">Filter</button>
        </form>
        <div className="space-y-2">
          {riwayat.length === 0 && (
            <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              Belum ada pembayaran.
            </p>
          )}
          {riwayat.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">
                  {p.student.nama} <span className="font-normal text-slate-500">({p.student.memberId})</span>
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Iuran {labelPeriode(p.invoice.periode)} · {formatTanggal(p.tanggal)}
                  {p.petugas && ` · petugas: ${p.petugas.name}`}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-0">
                <span className="text-sm font-extrabold">{rupiah(p.nominal)}</span>
                <BadgeMetode metode={p.metode} />
                <BadgeIuran status={p.status} />
              </div>
            </div>
          ))}
        </div>
        {totalHalaman > 1 && (
          <p className="mt-4 text-sm text-slate-500">
            Halaman {halaman} dari {totalHalaman} — gunakan parameter ?page= untuk navigasi.
          </p>
        )}
      </section>
    </div>
  );
}

async function PembayaranSiswa() {
  const u = await wajibLogin();
  if (!u.studentId) {
    return (
      <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        Akun ini tidak terhubung ke data siswa.
      </p>
    );
  }
  const riwayat = await prisma.payment.findMany({
    where: { studentId: u.studentId },
    orderBy: { createdAt: "desc" },
    include: {
      invoice: { select: { periode: true } },
      proof: { select: { url: true } },
    },
  });

  return (
    <div className="space-y-2">
      {riwayat.length === 0 && (
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Belum ada riwayat pembayaran.
        </p>
      )}
      {riwayat.map((p) => (
        <div key={p.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">Iuran {labelPeriode(p.invoice.periode)}</p>
              <p className="mt-0.5 text-sm text-slate-500">{formatTanggal(p.tanggal)}</p>
              {p.status === "DITOLAK" && p.alasanPenolakan && (
                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  Alasan: {p.alasanPenolakan}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold">{rupiah(p.nominal)}</p>
              <div className="mt-1 flex justify-end gap-1">
                <BadgeMetode metode={p.metode} />
                <BadgeIuran status={p.status} />
              </div>
            </div>
          </div>
          {p.proof?.url && (
            <a
              href={p.proof.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-dojo-700 underline"
            >
              Lihat bukti transfer
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function PembayaranPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await wajibRole("ADMIN", "SISWA");
  const sp = await searchParams;

  return (
    <div className="anim-fade-up mx-auto max-w-6xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Pembayaran</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {u.role === "ADMIN"
          ? "Verifikasi pembayaran transfer, catat pembayaran tunai, dan pantau riwayat."
          : "Riwayat pembayaran iuran Anda."}
      </p>
      {u.role === "ADMIN" ? <PembayaranAdmin searchParams={sp} /> : <PembayaranSiswa />}
    </div>
  );
}
