import Link from "next/link";
import { prisma, Prisma } from "@/lib/db";
import { DayOfWeek } from "@prisma/client";
import { wajibRole, type SesiPengguna } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { NAMA_HARI } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { HapusButton } from "@/components/HapusButton";

const HARI_LIST: DayOfWeek[] = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"];

type SearchParams = { dojo?: string; hari?: string; aktif?: string };

async function bangunWhere(u: SesiPengguna, sp: SearchParams): Promise<Prisma.ScheduleWhereInput> {
  const where: Prisma.ScheduleWhereInput = {};
  if (sp.hari && (HARI_LIST as string[]).includes(sp.hari)) where.hari = sp.hari as DayOfWeek;
  if (sp.aktif === "aktif") where.isActive = true;
  else if (sp.aktif === "nonaktif") where.isActive = false;

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.dojo) {
      where.dojoId = sp.dojo;
    }
  } else {
    const ids = await dojoIdsUntukSensei(u.coachId);
    const dipilih = sp.dojo && ids.includes(sp.dojo) ? [sp.dojo] : ids;
    where.dojoId = { in: dipilih.length > 0 ? dipilih : ["__kosong__"] };
  }
  return where;
}

function FilterBar({
  sp,
  dojoList,
  tampilFilterDojo,
  isAdmin,
}: {
  sp: SearchParams;
  dojoList: { id: string; nama: string }[];
  tampilFilterDojo: boolean;
  isAdmin: boolean;
}) {
  const inputCls = "brutal-input sm:w-auto";
  return (
    <form method="GET" className="flex flex-wrap gap-2">
      {tampilFilterDojo && (
        <select name="dojo" defaultValue={sp.dojo ?? ""} className={inputCls} aria-label="Filter dojo">
          <option value="">Semua dojo</option>
          {dojoList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </select>
      )}
      <select name="hari" defaultValue={sp.hari ?? ""} className={inputCls} aria-label="Filter hari">
        <option value="">Semua hari</option>
        {HARI_LIST.map((h) => (
          <option key={h} value={h}>
            {NAMA_HARI[h]}
          </option>
        ))}
      </select>
      {isAdmin && (
        <select name="aktif" defaultValue={sp.aktif ?? ""} className={inputCls} aria-label="Filter status">
          <option value="">Aktif + nonaktif</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </select>
      )}
      <button type="submit" className="brutal-btn brutal-btn-primary">
        Tampilkan
      </button>
    </form>
  );
}

export default async function JadwalListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const sp = await searchParams;
  const isAdmin = u.role === "ADMIN";
  const where = await bangunWhere(u, sp);

  const data = await prisma.schedule.findMany({
    where,
    orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
    include: {
      dojo: { select: { id: true, nama: true } },
      coach: { select: { id: true, nama: true } },
    },
  });

  const tampilFilterDojo = isAdmin && !u.scopeDojoId;
  const dojoList = tampilFilterDojo
    ? await prisma.dojo.findMany({
        where: { isActive: true },
        orderBy: { nama: "asc" },
        select: { id: true, nama: true },
      })
    : [];

  return (
    <div className="anim-fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="brutal-title text-2xl">JADWAL LATIHAN</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? "Kelola jadwal latihan setiap dojo."
              : "Jadwal latihan di dojo Anda."}
          </p>
        </div>
        {isAdmin && (
          <Link href="/dashboard/jadwal/tambah" className="brutal-btn brutal-btn-primary">
            Tambah Jadwal
          </Link>
        )}
      </div>

      <div className="mb-4">
        <FilterBar sp={sp} dojoList={dojoList} tampilFilterDojo={tampilFilterDojo} isAdmin={isAdmin} />
      </div>

      {data.length === 0 ? (
        <p className="brutal-card p-6 text-sm text-slate-500">
          Belum ada jadwal latihan.
          {isAdmin && " Tambahkan jadwal pertama melalui tombol di atas."}
        </p>
      ) : (
        <>
          {/* Mobile: kartu */}
          <ul className="space-y-3 lg:hidden">
            {data.map((j) => (
              <li key={j.id} className="brutal-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{j.namaLatihan}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {NAMA_HARI[j.hari]} · {j.jamMulai}–{j.jamSelesai}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {j.dojo.nama}
                      {j.coach ? ` · Sensei ${j.coach.nama}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={j.isActive ? "AKTIF" : "TIDAK_AKTIF"} label={j.isActive ? "Aktif" : "Nonaktif"} />
                </div>
                {isAdmin && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/dashboard/jadwal/${j.id}/ubah`}
                      className="brutal-btn brutal-btn-light flex-1"
                    >
                      Ubah
                    </Link>
                    <HapusButton
                      nama={`jadwal ${j.namaLatihan}`}
                      endpoint={`/api/jadwal/${j.id}`}
                      kembaliKe="/dashboard/jadwal"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: tabel */}
          <div className="hidden overflow-x-auto brutal-card lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Latihan</th>
                  <th className="px-4 py-3 font-semibold">Hari</th>
                  <th className="px-4 py-3 font-semibold">Jam</th>
                  <th className="px-4 py-3 font-semibold">Dojo</th>
                  <th className="px-4 py-3 font-semibold">Sensei</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((j) => (
                  <tr key={j.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{j.namaLatihan}</td>
                    <td className="px-4 py-3">{NAMA_HARI[j.hari]}</td>
                    <td className="px-4 py-3">
                      {j.jamMulai}–{j.jamSelesai}
                    </td>
                    <td className="px-4 py-3">{j.dojo.nama}</td>
                    <td className="px-4 py-3">{j.coach?.nama ?? "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={j.isActive ? "AKTIF" : "TIDAK_AKTIF"} label={j.isActive ? "Aktif" : "Nonaktif"} />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/dashboard/jadwal/${j.id}/ubah`}
                            className="brutal-btn brutal-btn-light"
                          >
                            Ubah
                          </Link>
                          <HapusButton
                            nama={`jadwal ${j.namaLatihan}`}
                            endpoint={`/api/jadwal/${j.id}`}
                            kembaliKe="/dashboard/jadwal"
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
