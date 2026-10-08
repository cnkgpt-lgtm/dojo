"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Tombol hapus dengan konfirmasi. Dipakai di halaman detail. */
export function HapusButton({
  endpoint,
  kembaliKe,
}: {
  nama: string;
  endpoint: string;
  kembaliKe: string;
}) {
  const [menghapus, setMenghapus] = useState(false);
  const [galat, setGalat] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);
  const router = useRouter();

  async function hapus() {
    // Konfirmasi inline dua langkah (bukan dialog confirm() bawaan browser).
    if (!konfirmasi) {
      setKonfirmasi(true);
      return;
    }
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
      setKonfirmasi(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={hapus}
        disabled={menghapus}
        className={`inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold ring-1 disabled:opacity-50 ${
          konfirmasi
            ? "bg-amber-600 text-white ring-amber-600"
            : "text-red-700 ring-red-200"
        }`}
      >
        {menghapus ? "Menghapus..." : konfirmasi ? "Yakin hapus?" : "Hapus"}
      </button>
      {galat && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}
    </div>
  );
}
