"use client";

import { useRef, useState } from "react";
import type { TipeUpload } from "@/lib/upload";

const MAKS_2MB = 2 * 1024 * 1024;

/** Unggah foto ke /api/upload dengan pratinjau langsung. */
export function FotoUpload({
  tipe,
  nilaiAwal,
  onBerhasil,
}: {
  tipe: TipeUpload;
  nilaiAwal?: string | null;
  onBerhasil: (url: string) => void;
}) {
  const [pratinjau, setPratinjau] = useState<string | null>(nilaiAwal ?? null);
  const [mengunggah, setMengunggah] = useState(false);
  const [pesan, setPesan] = useState("");
  const [gagal, setGagal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function saatPilih(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAKS_2MB) {
      setGagal(true);
      setPesan("Ukuran foto maksimal 2MB.");
      return;
    }
    setPratinjau(URL.createObjectURL(file));
    setMengunggah(true);
    setGagal(false);
    setPesan("Mengunggah foto...");
    const fd = new FormData();
    fd.append("foto", file);
    fd.append("tipe", tipe);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload foto gagal. Silakan coba kembali.");
      setPesan("Foto terunggah.");
      onBerhasil(json.url as string);
    } catch (err) {
      setGagal(true);
      setPesan(err instanceof Error ? err.message : "Upload foto gagal. Silakan coba kembali.");
    } finally {
      setMengunggah(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        aria-hidden="true"
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
      >
        {pratinjau ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pratinjau} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl font-extrabold text-slate-300">?</span>
        )}
      </div>
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={saatPilih}
          className="hidden"
          aria-label="Pilih foto"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={mengunggah}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {mengunggah ? "Mengunggah..." : pratinjau ? "Ganti Foto" : "Pilih Foto"}
        </button>
        <p className={`mt-1.5 text-xs ${gagal ? "text-red-600" : "text-slate-500"}`} role="status">
          {pesan || "JPG, PNG, atau WebP. Maksimal 2MB."}
        </p>
      </div>
    </div>
  );
}
