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
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      {pesan && (
        <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          {pesan}
        </p>
      )}
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
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
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
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
        className="mt-4 rounded-xl bg-dojo-700 px-6 py-2.5 font-bold text-white disabled:opacity-50"
      >
        {sibuk ? "Menyimpan…" : "Simpan Pengaturan"}
      </button>
    </div>
  );
}
