import Link from "next/link";
import { wajibLogin } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/LogoutButton";
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

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const u = await wajibLogin();
  const belumDibaca = await prisma.notification.count({
    where: { userId: u.id, isRead: false },
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-dojo-700 text-sm font-extrabold text-white"
          >
            DK
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">DojoKu</p>
            <p className="truncate text-xs text-slate-500">
              {u.name} · {LABEL_ROLE[u.role]}
            </p>
          </div>
          {/* Lonceng notifikasi (§43) */}
          <Link
            href="/dashboard/notifikasi"
            aria-label={`Notifikasi${belumDibaca > 0 ? `, ${belumDibaca} belum dibaca` : ""}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 ring-1 ring-transparent focus-visible:ring-2 focus-visible:ring-dojo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.6V11a6 6 0 10-12 0v3.6a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {belumDibaca > 0 && (
              <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
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
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 px-4 py-6 lg:block">
          <nav aria-label="Navigasi utama" className="space-y-1">
            {MENU_UTAMA[u.role].map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="block rounded-xl bg-dojo-50 px-4 py-3 text-sm font-semibold text-dojo-800"
              >
                {m.label}
              </Link>
            ))}
          </nav>
          <p className="mt-8 mb-2 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Segera hadir
          </p>
          <ul aria-label="Fitur yang akan datang" className="space-y-1">
            {MENU_SEGERA[u.role].map((label) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm text-slate-400"
              >
                <span>{label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium">
                  Segera
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 px-1">
            <LogoutButton />
          </div>
        </aside>

        {/* Konten */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Navigasi bawah mobile */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white lg:hidden"
      >
        <div className="mx-auto flex max-w-6xl">
          {MENU_UTAMA[u.role].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 text-dojo-700"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-dojo-700 text-[11px] font-extrabold text-white"
              >
                {m.label.charAt(0)}
              </span>
              <span className="text-xs font-semibold">{m.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
