"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Aksi per baris pengguna: nonaktifkan/aktifkan + reset kata sandi (inline, tanpa dialog bawaan). */
export function PenggunaAksi({
  id,
  nama,
  isActive,
  milikSendiri,
}: {
  id: string;
  nama: string;
  isActive: boolean;
  milikSendiri: boolean;
}) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [modeSandi, setModeSandi] = useState(false);
  const [sandiBaru, setSandiBaru] = useState("");
  const [galat, setGalat] = useState("");

  async function kirim(body: Record<string, unknown>) {
    setSibuk(true);
    setGalat("");
    try {
      const r = await fetch(`/api/pengguna/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGalat(j.error ?? "Gagal memperbarui pengguna.");
        return;
      }
      setKonfirmasi(false);
      setModeSandi(false);
      setSandiBaru("");
      router.refresh();
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end gap-1">
        {!milikSendiri && (
          <button
            disabled={sibuk}
            onClick={() => (konfirmasi ? kirim({ isActive: !isActive }) : setKonfirmasi(true))}
            onBlur={() => setKonfirmasi(false)}
            className={`min-h-[40px] rounded-lg px-3 text-xs font-bold ring-1 disabled:opacity-50 ${
              konfirmasi
                ? "bg-amber-600 text-white ring-amber-600"
                : "text-slate-600 ring-slate-200"
            }`}
          >
            {konfirmasi ? "Yakin?" : isActive ? "Nonaktifkan" : "Aktifkan"}
          </button>
        )}
        <button
          disabled={sibuk}
          onClick={() => {
            setModeSandi(!modeSandi);
            setGalat("");
          }}
          className="min-h-[40px] rounded-lg px-3 text-xs font-bold text-dojo-700 ring-1 ring-dojo-100 disabled:opacity-50"
        >
          Reset sandi
        </button>
      </div>
      {modeSandi && (
        <form
          className="mt-2 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (sandiBaru.length < 6) {
              setGalat("Kata sandi minimal 6 karakter.");
              return;
            }
            kirim({ password: sandiBaru });
          }}
        >
          <input
            type="password"
            value={sandiBaru}
            onChange={(e) => setSandiBaru(e.target.value)}
            placeholder="Sandi baru"
            aria-label={`Kata sandi baru untuk ${nama}`}
            className="min-h-[40px] w-32 rounded-lg border border-slate-300 px-3 text-xs focus:border-dojo-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sibuk}
            className="min-h-[40px] rounded-lg bg-dojo-700 px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            OK
          </button>
        </form>
      )}
      {galat && <p className="mt-1 text-right text-xs font-medium text-red-600">{galat}</p>}
    </div>
  );
}
