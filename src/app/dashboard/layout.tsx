import Link from "next/link";
import { wajibLogin } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import type { Role } from "@prisma/client";

const LABEL_ROLE: Record<Role, string> = {
  ADMIN: "Admin",
  SENSEI: "Sensei",
  SISWA: "Siswa",
};

// Menu navigasi hanya berisi halaman yang sudah ada (R-24).
// Sensei tidak mendapat menu finance (tak boleh lihat keuangan, §6).
const MENU_UTAMA: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/siswa", label: "Siswa" },
    { href: "/dashboard/sensei", label: "Sensei" },
    { href: "/dashboard/jadwal", label: "Jadwal" },
    { href: "/dashboard/absensi/monitor", label: "Absensi" },
    { href: "/dashboard/iuran", label: "Iuran" },
    { href: "/dashboard/pembayaran", label: "Pembayaran" },
    { href: "/dashboard/keuangan", label: "Keuangan" },
    { href: "/dashboard/laporan", label: "Laporan" },
    { href: "/dashboard/pengumuman", label: "Pengumuman" },
    { href: "/dashboard/sabuk", label: "Sabuk" },
    { href: "/dashboard/penilaian", label: "Penilaian" },
    { href: "/dashboard/pengguna", label: "Pengguna" },
    { href: "/dashboard/pengaturan/lokasi", label: "Lokasi" },
    { href: "/dashboard/profil", label: "Profil" },
  ],
  SENSEI: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/jadwal", label: "Jadwal" },
    { href: "/dashboard/absensi/monitor", label: "Absensi" },
    { href: "/dashboard/siswa", label: "Siswa" },
    { href: "/dashboard/sabuk/kenaikan", label: "Sabuk" },
    { href: "/dashboard/penilaian", label: "Penilaian" },
    { href: "/dashboard/pengumuman", label: "Pengumuman" },
    { href: "/dashboard/profil", label: "Profil" },
  ],
  SISWA: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/absensi", label: "Absensi" },
    { href: "/dashboard/iuran", label: "Iuran" },
    { href: "/dashboard/pembayaran", label: "Pembayaran" },
    { href: "/dashboard/perkembangan", label: "Perkembangan" },
    { href: "/dashboard/pengumuman", label: "Pengumuman" },
    { href: "/dashboard/profil", label: "Profil" },
  ],
};

// Roadmap Phase 5+: ditampilkan sebagai daftar non-interaktif berlabel "Segera",
// bukan tombol mati (R-26).
const MENU_SEGERA: Record<Role, string[]> = {
  ADMIN: ["Dojo", "Pengaturan"],
  SENSEI: [],
  SISWA: ["Jadwal", "Kehadiran"],
};

// Tab utama bilah bawah mobile (maks 4 + "Lainnya"); sisanya masuk lembar bawah.
const TAB_UTAMA: Record<Role, string[]> = {
  ADMIN: ["/dashboard", "/dashboard/siswa", "/dashboard/pembayaran", "/dashboard/keuangan"],
  SENSEI: ["/dashboard", "/dashboard/absensi/monitor", "/dashboard/penilaian", "/dashboard/siswa"],
  SISWA: ["/dashboard", "/dashboard/absensi", "/dashboard/iuran", "/dashboard/pembayaran"],
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await wajibLogin();
  const belumDibaca = await prisma.notification.count({
    where: { userId: u.id, isRead: false },
  });
  const semuaMenu = MENU_UTAMA[u.role];
  const hrefUtama = TAB_UTAMA[u.role];
  const menuUtama = hrefUtama
    .map((h) => semuaMenu.find((m) => m.href === h))
    .filter((m): m is { href: string; label: string } => !!m);
  const menuLainnya = semuaMenu.filter((m) => !hrefUtama.includes(m.href));

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b-2 border-black bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div
            aria-hidden="true"
            className="brutal-title flex h-10 w-10 items-center justify-center rounded-lg border-2 border-black bg-dojo-600 text-sm text-white shadow-[2px_2px_0px_0px_#000]"
          >
            DK
          </div>
          <div className="min-w-0 flex-1">
            <p className="brutal-title truncate text-base leading-tight">DOJOKU</p>
            <p className="truncate text-xs font-bold text-slate-500">
              {u.name} · {LABEL_ROLE[u.role]}
            </p>
          </div>
          {/* Lonceng notifikasi (§43) */}
          <Link
            href="/dashboard/notifikasi"
            aria-label={`Notifikasi${belumDibaca > 0 ? `, ${belumDibaca} belum dibaca` : ""}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.6V11a6 6 0 10-12 0v3.6a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {belumDibaca > 0 && (
              <span className="brutal-angka absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-md border-2 border-black bg-red-600 px-1 text-[11px] text-white">
                {belumDibaca > 99 ? "99+" : belumDibaca}
              </span>
            )}
          </Link>
          <div className="hidden sm:block">
            <LogoutButton compact />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 border-r-2 border-black bg-white px-4 py-6 lg:block">
          <nav aria-label="Navigasi utama" className="space-y-2">
            {MENU_UTAMA[u.role].map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="block rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-extrabold text-black shadow-[2px_2px_0px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                {m.label}
              </Link>
            ))}
          </nav>
          <p className="mb-2 mt-8 px-1 text-xs font-black uppercase tracking-widest text-slate-400">
            Segera hadir
          </p>
          <ul aria-label="Fitur yang akan datang" className="space-y-2">
            {MENU_SEGERA[u.role].map((label) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-lg border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-400"
              >
                <span>{label}</span>
                <span className="brutal-badge bg-slate-100 text-slate-500">Segera</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <LogoutButton />
          </div>
        </aside>

        {/* Konten */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Navigasi bawah mobile: bilah mengambang 4 tab + "Lainnya" */}
      <MobileNav utama={menuUtama} lainnya={menuLainnya} segera={MENU_SEGERA[u.role]} />
    </div>
  );
}
