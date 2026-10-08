"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Tombol hapus dengan konfirmasi. Dipakai di halaman detail. */
export function HapusButton({
  nama,
  endpoint,
  kembaliKe,
}: {
  nama: string;
  endpoint: string;
  kembaliKe: string;
}) {
  const [menghapus, setMenghapus] = useState(false);
  const [galat, setGalat] = useState("");
  const router = useRouter();

  async function hapus() {
    if (!window.confirm(`Hapus ${nama}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setMenghapus(true);
    setGalat("");
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menghapus data.");
      router.push(kembaliKe);
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menghapus data.");
      setMenghapus(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={hapus}
        disabled={menghapus}
        className="inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-50"
      >
        {menghapus ? "Menghapus..." : "Hapus"}
      </button>
      {galat && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}
    </div>
  );
}
