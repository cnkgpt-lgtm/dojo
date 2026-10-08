import { prisma, Prisma } from "@/lib/db";
import { AttendanceStatus } from "@prisma/client";
import { wajibRole, type SesiPengguna } from "@/lib/authz";
import { dojoIdsUntukSensei } from "@/lib/api-auth";
import { sekarangMakassar } from "@/lib/absensi";
import {
  NAMA_HARI,
  LABEL_STATUS_ABSENSI,
  WARNA_STATUS_ABSENSI,
  formatTanggal,
} from "@/lib/format";
import { KoreksiAbsensi } from "@/components/KoreksiAbsensi";
import { Pagination } from "@/components/Pagination";
import { BadgePenyimpanan } from "@/components/BadgePenyimpanan";

const PER_HALAMAN = 15;
const STATUS_LIST: AttendanceStatus[] = ["HADIR", "TERLAMBAT", "DITOLAK", "DIBATALKAN"];

type SearchParams = {
  tanggal?: string;
  dojo?: string;
  status?: string;
  jadwal?: string;
  q?: string;
  page?: string;
};

async function bangunWhere(u: SesiPengguna, sp: SearchParams): Promise<Prisma.AttendanceWhereInput> {
  const where: Prisma.AttendanceWhereInput = {};

  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal ?? "")) {
    const [y, m, d] = sp.tanggal!.split("-").map(Number);
    where.tanggal = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }
  if (sp.status && (STATUS_LIST as string[]).includes(sp.status))
    where.status = sp.status as AttendanceStatus;
  if (sp.jadwal) where.scheduleId = sp.jadwal;

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.dojo) {
      where.dojoId = sp.dojo;
    }
  } else {
    const ids = await dojoIdsUntukSensei(u.coachId);
    const daftar = ids.length > 0 ? ids : ["__kosong__"];
    const filterDojo = sp.dojo;
    where.dojoId = filterDojo && daftar.includes(filterDojo) ? filterDojo : { in: daftar };
  }

  const q = sp.q?.trim();
  if (q) {
    where.student = {
      OR: [
        { nama: { contains: q, mode: "insensitive" } },
        { memberId: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  return where;
}

function buatHref(sp: SearchParams, halaman: number): string {
  const p = new URLSearchParams();
  if (sp.tanggal) p.set("tanggal", sp.tanggal);
  if (sp.dojo) p.set("dojo", sp.dojo);
  if (sp.status) p.set("status", sp.status);
  if (sp.jadwal) p.set("jadwal", sp.jadwal);
  if (sp.q) p.set("q", sp.q);
  p.set("page", String(halaman));
  return `/dashboard/absensi/monitor?${p.toString()}`;
}

/** Halaman monitor absensi: admin & sensei (§6, §37). */
export default async function MonitorAbsensiPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const u = await wajibRole("ADMIN", "SENSEI");
  const sp = await searchParams;
  const isAdmin = u.role === "ADMIN";
  const halaman = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const spEfektif: SearchParams = {
    ...sp,
    tanggal: sp.tanggal ?? sekarangMakassar().tanggalStr,
  };
  const where = await bangunWhere(u, spEfektif);

  const [total, data, rekap] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      orderBy: [{ jam: "desc" }],
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        student: { select: { nama: true, memberId: true } },
        schedule: { select: { id: true, namaLatihan: true, hari: true, jamMulai: true } },
        dojo: { select: { id: true, nama: true } },
        photo: { select: { url: true } },
        location: { select: { jarakMeter: true, statusGps: true } },
      },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    }),
  ]);
  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const jumlah = (s: string) => rekap.find((r) => r.status === s)?._count.status ?? 0;

  const tampilFilterDojo = isAdmin && !u.scopeDojoId;
  const [dojoList, jadwalList] = await Promise.all([
    tampilFilterDojo
      ? prisma.dojo.findMany({
          where: { isActive: true },
          orderBy: { nama: "asc" },
          select: { id: true, nama: true },
        })
      : [],
    prisma.schedule.findMany({
      where: {
        isActive: true,
        ...(isAdmin
          ? u.scopeDojoId
            ? { dojoId: u.scopeDojoId }
            : spEfektif.dojo
              ? { dojoId: spEfektif.dojo }
              : {}
          : { dojoId: { in: await dojoIdsUntukSensei(u.coachId) } }),
      },
      orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
      select: { id: true, namaLatihan: true, hari: true, jamMulai: true },
    }),
  ]);

  const inputCls = "brutal-input sm:w-auto";

  return (
    <div className="anim-fade-up">
      <h1 className="brutal-title text-2xl">MONITOR ABSENSI</h1>
      <p className="mt-1 mb-3 text-sm text-slate-500">
        {jumlah("HADIR")} hadir · {jumlah("TERLAMBAT")} terlambat · {jumlah("DIBATALKAN")} dibatalkan
      </p>
      <div className="mb-6">
        <BadgePenyimpanan />
      </div>

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          type="date"
          name="tanggal"
          defaultValue={spEfektif.tanggal}
          aria-label="Filter tanggal"
          className={inputCls}
        />
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
        <select name="jadwal" defaultValue={sp.jadwal ?? ""} className={inputCls} aria-label="Filter jadwal">
          <option value="">Semua jadwal</option>
          {jadwalList.map((j) => (
            <option key={j.id} value={j.id}>
              {NAMA_HARI[j.hari]} {j.jamMulai} · {j.namaLatihan}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputCls} aria-label="Filter status">
          <option value="">Semua status</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>
              {LABEL_STATUS_ABSENSI[s]}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Cari nama / Member ID"
          aria-label="Cari siswa"
          className={inputCls}
        />
        <button type="submit" className="brutal-btn brutal-btn-primary">
          Tampilkan
        </button>
      </form>

      {data.length === 0 ? (
        <p className="brutal-card p-6 text-sm text-slate-500">
          Belum ada data absensi untuk filter ini.
        </p>
      ) : (
        <>
          {/* Mobile: kartu */}
          <ul className="space-y-3 lg:hidden">
            {data.map((a) => (
              <li key={a.id} className="brutal-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dojo-700 text-sm font-extrabold text-white"
                  >
                    {a.photo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/absensi/${a.id}/foto`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      a.student.nama.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{a.student.nama}</p>
                    <p className="text-xs text-slate-500">
                      {a.student.memberId} · {a.schedule.namaLatihan}
                    </p>
                    <p className="text-xs text-slate-400">
                      {NAMA_HARI[a.schedule.hari]}, {formatTanggal(a.tanggal)}
                      {a.location ? ` · ${a.location.jarakMeter} m` : ""}
                    </p>
                  </div>
                  <span className={`brutal-badge ${WARNA_STATUS_ABSENSI[a.status]}`}>
                    {LABEL_STATUS_ABSENSI[a.status]}
                  </span>
                </div>
                {isAdmin && (
                  <KoreksiAbsensi absensiId={a.id} statusAwal={a.status} />
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: tabel */}
          <div className="hidden overflow-x-auto brutal-card lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Siswa</th>
                  <th className="px-4 py-3 font-semibold">Jadwal</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Jarak</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold">Koreksi</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dojo-700 text-xs font-extrabold text-white"
                        >
                          {a.photo?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/absensi/${a.id}/foto`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            a.student.nama.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{a.student.nama}</p>
                          <p className="text-xs text-slate-500">{a.student.memberId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.schedule.namaLatihan}
                      <p className="text-xs text-slate-500">
                        {NAMA_HARI[a.schedule.hari]} {a.schedule.jamMulai}
                      </p>
                    </td>
                    <td className="px-4 py-3">{formatTanggal(a.tanggal)}</td>
                    <td className="px-4 py-3">
                      {a.location ? `${a.location.jarakMeter} m` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`brutal-badge ${WARNA_STATUS_ABSENSI[a.status]}`}>
                        {LABEL_STATUS_ABSENSI[a.status]}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <KoreksiAbsensi absensiId={a.id} statusAwal={a.status} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination
              halaman={halaman}
              totalHalaman={totalHalaman}
              buatHref={(h) => buatHref(spEfektif, h)}
            />
          </div>
        </>
      )}
    </div>
  );
}
