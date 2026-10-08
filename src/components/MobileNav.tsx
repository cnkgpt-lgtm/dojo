"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

type Item = { href: string; label: string };

/** Ikon garis sederhana per halaman (tanpa emoji, tanpa huruf kotak). */
function Ikon({ href }: { href: string }) {
  const cls = "h-6 w-6";
  const p = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const isi: Record<string, ReactNode> = {
    "/dashboard": (
      <path d="M4 6a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3zm10 0a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3z" />
    ),
    "/dashboard/siswa": (
      <path d="M16 19c0-3.3-2.7-6-6-6s-6 2.7-6 6M10 11a4 4 0 100-8 4 4 0 000 8zm8 8c0-2.2-.9-4.2-2.4-5.6M17 11a3 3 0 100-6" />
    ),
    "/dashboard/sensei": (
      <path d="M12 14c-3.3 0-6 2.7-6 6v1h12v-1c0-3.3-2.7-6-6-6zm0-9a4 4 0 100 8 4 4 0 000-8z" />
    ),
    "/dashboard/jadwal": (
      <path d="M8 3v4m8-4v4M4 9h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
    ),
    "/dashboard/absensi/monitor": (
      <path d="M9 5h9a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2m3 0V3h4v2m-4 0H9m5 9l-3 3-2-2" />
    ),
    "/dashboard/absensi": (
      <path d="M9 5h9a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h2m3 0V3h4v2m-4 0H9m5 9l-3 3-2-2" />
    ),
    "/dashboard/iuran": (
      <path d="M20 7H5a2 2 0 00-2 2v9a2 2 0 002 2h15a1 1 0 001-1V8a1 1 0 00-1-1zm-1 5h-4a1 1 0 000 2h4m-2-9H7a2 2 0 00-2 2v1h14V5a1 1 0 00-1-1z" />
    ),
    "/dashboard/pembayaran": (
      <path d="M4 7h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm0 4h16M7 15h4" />
    ),
    "/dashboard/keuangan": (
      <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
    ),
    "/dashboard/laporan": (
      <path d="M7 3h8l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2zm1 9h8m-8 4h8M15 3v4h4" />
    ),
    "/dashboard/pengumuman": (
      <path d="M3 11l14-6v14L3 13v-2zm14-6v14M7 13v6a2 2 0 002 2h1" />
    ),
    "/dashboard/sabuk": (
      <path d="M12 15a6 6 0 100-12 6 6 0 000 12zm-3 3L7 21l3-1 2 3 2-3 3 1-2-3" />
    ),
    "/dashboard/sabuk/kenaikan": (
      <path d="M12 15a6 6 0 100-12 6 6 0 000 12zm-3 3L7 21l3-1 2 3 2-3 3 1-2-3" />
    ),
    "/dashboard/penilaian": (
      <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3z" />
    ),
    "/dashboard/perkembangan": (
      <path d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5" />
    ),
    "/dashboard/profil": (
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />
    ),
    "/dashboard/pengguna": (
      <path d="M12 5v2m0 0v2m0-2h2m-2 0H10M8 21v-1a4 4 0 014-4h0a4 4 0 014 4v1M5 8a3 3 0 013-3h8a3 3 0 013 3v8a3 3 0 01-3 3H8a3 3 0 01-3-3V8z" />
    ),
    "/dashboard/pengaturan/lokasi": (
      <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden="true" {...p}>
      {isi[href] ?? isi["/dashboard"]}
    </svg>
  );
}

function aktif(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Navigasi bawah mobile: bilah mengambang berisi 4 tab utama + "Lainnya".
 * "Lainnya" membuka lembar bawah berisi sisa menu + fitur segera hadir.
 */
export function MobileNav({
  utama,
  lainnya,
  segera,
}: {
  utama: Item[];
  lainnya: Item[];
  segera: string[];
}) {
  const pathname = usePathname();
  const [lembar, setLembar] = useState(false);

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-3 bottom-3 z-20 rounded-3xl bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/10 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex px-2 py-2">
          {utama.map((m) => {
            const ya = aktif(pathname, m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={ya ? "page" : undefined}
                className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition-colors ${
                  ya ? "bg-dojo-100 text-dojo-800" : "text-slate-500 active:bg-slate-100"
                }`}
              >
                <Ikon href={m.href} />
                <span className="leading-none">{m.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setLembar(true)}
            aria-label="Menu lainnya"
            className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold text-slate-500 active:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
            <span className="leading-none">Lainnya</span>
          </button>
        </div>
      </nav>

      {lembar && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu lainnya">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setLembar(false)} />
          <div className="anim-slide-up absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="grid grid-cols-2 gap-2">
              {lainnya.map((m) => {
                const ya = aktif(pathname, m.href);
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setLembar(false)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ring-1 transition-colors ${
                      ya
                        ? "bg-dojo-100 text-dojo-800 ring-dojo-200"
                        : "bg-white text-slate-700 ring-slate-200 active:bg-slate-50"
                    }`}
                  >
                    <Ikon href={m.href} />
                    <span className="text-sm font-semibold">{m.label}</span>
                  </Link>
                );
              })}
            </div>
            {segera.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Segera hadir
                </p>
                <div className="flex flex-wrap gap-2">
                  {segera.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
