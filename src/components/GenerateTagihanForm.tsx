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
  const [konfirmasi, setKonfirmasi] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    setHasil(null);
    if (!PERIODE_REGEX.test(periode)) {
      setGalat("Format periode harus YYYY-MM, mis. 2026-11.");
      return;
    }
    // Konfirmasi inline dua langkah (bukan dialog confirm() bawaan browser).
    if (!konfirmasi) {
      setKonfirmasi(true);
      return;
    }
    setSibuk(true);
    const r = await fetch("/api/tagihan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periode, dojoId: dojoId || null }),
    });
    const j = await r.json().catch(() => ({}));
    setSibuk(false);
    setKonfirmasi(false);
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
      className="brutal-card bg-slate-50 p-5 sm:flex sm:items-end sm:gap-3"
    >
      <label className="block flex-1">
        <span className="mb-1 block text-sm font-semibold">Periode</span>
        <input
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          placeholder="2026-11"
          className="brutal-input"
        />
      </label>
      {dojoList.length > 1 && (
        <label className="mt-3 block flex-1 sm:mt-0">
          <span className="mb-1 block text-sm font-semibold">Dojo</span>
          <select
            value={dojoId}
            onChange={(e) => setDojoId(e.target.value)}
            className="brutal-input"
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
        className={`brutal-btn mt-3 w-full sm:mt-0 sm:w-auto ${konfirmasi ? "brutal-btn-warn" : "brutal-btn-primary"}`}
      >
        {sibuk ? "Memproses..." : konfirmasi ? "Yakin, Buat Tagihan" : "Buat Tagihan"}
      </button>
      {hasil && (
        <p className="brutal-card mt-3 w-full bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {hasil}
        </p>
      )}
      {galat && (
        <p className="brutal-card mt-3 w-full bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {galat}
        </p>
      )}
    </form>
  );
}
