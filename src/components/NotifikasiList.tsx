"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LABEL_TIPE_NOTIFIKASI } from "@/lib/format";

type Notif = {
  id: string;
  judul: string;
  isi: string;
  tipe: string | null;
  isRead: boolean;
  createdAt: string;
};

function waktuRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const menit = Math.floor(diff / 60000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function NotifikasiList({ awal, belumDibaca }: { awal: Notif[]; belumDibaca: number }) {
  const router = useRouter();
  const [daftar, setDaftar] = useState<Notif[]>(awal);
  const [sisa, setSisa] = useState(belumDibaca);

  async function tandai(id: string) {
    const r = await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.ok) {
      setDaftar((d) => d.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setSisa((s) => Math.max(0, s - 1));
    }
  }

  async function tandaiSemua() {
    const r = await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semua: true }),
    });
    if (r.ok) {
      setDaftar((d) => d.map((n) => ({ ...n, isRead: true })));
      setSisa(0);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {sisa > 0 ? `${sisa} belum dibaca` : "Semua sudah dibaca"}
        </p>
        {sisa > 0 && (
          <button
            onClick={tandaiSemua}
            className="brutal-btn brutal-btn-light"
          >
            Tandai semua dibaca
          </button>
        )}
      </div>
      <div className="space-y-2">
        {daftar.length === 0 && (
          <p className="brutal-card p-6 text-center text-sm text-slate-500">
            Belum ada notifikasi.
          </p>
        )}
        {daftar.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.isRead && tandai(n.id)}
            className={`brutal-card w-full p-4 text-left ${
              n.isRead ? "" : "bg-dojo-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">
                {!n.isRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-dojo-700" aria-label="Belum dibaca" />}
                {n.judul}
              </p>
              <span className="shrink-0 text-xs text-slate-400">{waktuRelatif(n.createdAt)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{n.isi}</p>
            {n.tipe && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {LABEL_TIPE_NOTIFIKASI[n.tipe] ?? n.tipe}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
