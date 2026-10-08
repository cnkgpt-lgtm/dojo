"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PERIODE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Form generate tagihan bulanan (§19). Idempoten — aman ditekan ulang. */
export function GenerateTagihanForm({ dojoList }: { dojoList: { id: string; nama: string }[] }) {
  const router = useRouter();
  const sekarang = new Date();
  const bawaan = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, "0")}`;
  const [periode, setPeriode] = useState(bawaan);
  const [dojoId, setDojoId] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<string | null>(null);
  const [galat, setGalat] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    setHasil(null);
    if (!PERIODE_REGEX.test(periode)) {
      setGalat("Format periode harus YYYY-MM, mis. 2026-11.");
      return;
    }
    if (!confirm(`Buat tagihan periode ${periode}?`)) return;
    setSibuk(true);
    const r = await fetch("/api/tagihan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periode, dojoId: dojoId || null }),
    });
    const j = await r.json().catch(() => ({}));
    setSibuk(false);
    if (!r.ok) {
      setGalat(j.error ?? "Gagal membuat tagihan.");
      return;
    }
    setHasil(j.pesan ?? "Tagihan dibuat.");
    router.refresh();
  }

  return (
    <form
      onSubmit={generate}
      className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 sm:flex sm:items-end sm:gap-3"
    >
      <label className="block flex-1">
        <span className="mb-1 block text-sm font-semibold">Periode</span>
        <input
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          placeholder="2026-11"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100"
        />
      </label>
      {dojoList.length > 1 && (
        <label className="mt-3 block flex-1 sm:mt-0">
          <span className="mb-1 block text-sm font-semibold">Dojo</span>
          <select
            value={dojoId}
            onChange={(e) => setDojoId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100"
          >
            <option value="">Semua dojo</option>
            {dojoList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={sibuk}
        className="mt-3 min-h-[48px] w-full rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white disabled:opacity-50 sm:mt-0 sm:w-auto"
      >
        {sibuk ? "Memproses..." : "Buat Tagihan"}
      </button>
      {hasil && (
        <p className="mt-3 w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {hasil}
        </p>
      )}
      {galat && (
        <p className="mt-3 w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {galat}
        </p>
      )}
    </form>
  );
}
