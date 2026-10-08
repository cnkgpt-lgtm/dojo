"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SkalaForm({ skalaAwal }: { skalaAwal: "ANGKA" | "LABEL" }) {
  const router = useRouter();
  const [skala, setSkala] = useState(skalaAwal);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setSibuk(true);
    setPesan(null);
    try {
      const res = await fetch("/api/pengaturan/skala-penilaian", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skala }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan.");
      setPesan("Skala penilaian diperbarui.");
      router.refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="brutal-card p-5">
      {pesan && (
        <p className="brutal-card mb-4 px-4 py-3 text-sm font-medium text-slate-700">
          {pesan}
        </p>
      )}
      <div className="space-y-3">
        <label className="brutal-card flex cursor-pointer items-start gap-3 p-4">
          <input
            type="radio"
            name="skala"
            checked={skala === "ANGKA"}
            onChange={() => setSkala("ANGKA")}
            className="mt-1"
          />
          <span>
            <span className="font-bold">Angka 1–5</span>
            <span className="block text-sm text-slate-500">
              Nilai ditampilkan sebagai angka, contoh: 4/5.
            </span>
          </span>
        </label>
        <label className="brutal-card flex cursor-pointer items-start gap-3 p-4">
          <input
            type="radio"
            name="skala"
            checked={skala === "LABEL"}
            onChange={() => setSkala("LABEL")}
            className="mt-1"
          />
          <span>
            <span className="font-bold">Label</span>
            <span className="block text-sm text-slate-500">
              1 = Sangat Kurang, 2 = Kurang, 3 = Cukup, 4 = Baik, 5 = Sangat Baik.
            </span>
          </span>
        </label>
      </div>
      <button
        onClick={simpan}
        disabled={sibuk || skala === skalaAwal}
        className="brutal-btn brutal-btn-primary mt-4"
      >
        {sibuk ? "Menyimpan…" : "Simpan Pengaturan"}
      </button>
    </div>
  );
}
