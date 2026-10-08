import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DojoKu — Manajemen Member Karate & Dojo",
  description:
    "Sistem manajemen member karate & dojo: data siswa multi-dojo, jadwal, absensi selfie + GPS, iuran, keuangan, sabuk, dan penilaian.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
