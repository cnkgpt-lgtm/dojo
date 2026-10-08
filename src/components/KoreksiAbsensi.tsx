"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LABEL_STATUS_ABSENSI } from "@/lib/format";

const STATUS_KOREKSI = ["HADIR", "TERLAMBAT", "DIBATALKAN"] as const;

/**
 * Koreksi status absensi oleh admin. Perubahan dicatat di audit log (§45);
 * koreksi tidak menghapus jejak data asli.
 */
export function KoreksiAbsensi({
  absensiId,
  statusAwal,
}: {
  absensiId: string;
  statusAwal: string;
}) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const [status, setStatus] = useState(statusAwal);
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat("");
    try {
      const res = await fetch(`/api/absensi/${absensiId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, catatan: catatan.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal mengoreksi absensi.");
      setTerbuka(false);
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal mengoreksi absensi.");
      setMenyimpan(false);
    }
  }

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="brutal-btn brutal-btn-light"
      >
        Koreksi
      </button>
    );
  }

  return (
    <form
      onSubmit={simpan}
      className="mt-2 space-y-2 brutal-card p-3"
    >
      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status koreksi"
          className="brutal-input flex-1"
        >
          {STATUS_KOREKSI.map((s) => (
            <option key={s} value={s}>
              {LABEL_STATUS_ABSENSI[s]}
            </option>
          ))}
        </select>
      </div>
      <input
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Alasan koreksi (opsional)"
        maxLength={500}
        className="brutal-input"
      />
      {galat && (
        <p className="text-xs text-red-600" role="alert">
          {galat}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={menyimpan}
          className="brutal-btn brutal-btn-primary flex-1"
        >
          {menyimpan ? "Menyimpan..." : "Simpan Koreksi"}
        </button>
        <button
          type="button"
          onClick={() => setTerbuka(false)}
          className="brutal-btn brutal-btn-light"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
