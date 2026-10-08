"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DojoOption = { id: string; nama: string };

export type PengumumanAwal = {
  judul?: string;
  isi?: string;
  target?: string;
  dojoId?: string | null;
  tanggalMulai?: string | null;
  tanggalSelesai?: string | null;
  isActive?: boolean;
};

const inputCls =
  "mt-1 block w-full rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-dojo-700";
const labelCls = "block text-sm font-semibold";

function keInputTanggal(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function PengumumanForm({
  mode,
  pengumumanId,
  awal,
  dojoList,
  targetTerkunciDojo,
}: {
  mode: "tambah" | "ubah";
  pengumumanId?: string;
  awal: PengumumanAwal;
  dojoList: DojoOption[];
  /** Admin dojo: target dikunci ke DOJO miliknya. */
  targetTerkunciDojo: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    judul: awal.judul ?? "",
    isi: awal.isi ?? "",
    target: targetTerkunciDojo ? "DOJO" : (awal.target ?? "SEMUA"),
    dojoId: awal.dojoId ?? "",
    tanggalMulai: keInputTanggal(awal.tanggalMulai),
    tanggalSelesai: keInputTanggal(awal.tanggalSelesai),
    isActive: awal.isActive ?? true,
  });
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  function ubah<K extends keyof typeof form>(kunci: K, nilai: (typeof form)[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat("");
    try {
      const body = {
        judul: form.judul.trim(),
        isi: form.isi.trim(),
        target: form.target,
        dojoId: form.target === "DOJO" ? form.dojoId || null : null,
        tanggalMulai: form.tanggalMulai || null,
        tanggalSelesai: form.tanggalSelesai || null,
        isActive: form.isActive,
      };
      const res = await fetch(
        mode === "tambah" ? "/api/pengumuman" : `/api/pengumuman/${pengumumanId}`,
        {
          method: mode === "tambah" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan pengumuman.");
      router.push("/dashboard/pengumuman/kelola");
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan pengumuman.");
      setMenyimpan(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 sm:p-6">
      <div>
        <label htmlFor="judul" className={labelCls}>
          Judul
        </label>
        <input
          id="judul"
          className={inputCls}
          value={form.judul}
          onChange={(e) => ubah("judul", e.target.value)}
          placeholder="cth. Latihan Sabtu ditiadakan"
          required
          maxLength={150}
        />
      </div>

      <div>
        <label htmlFor="isi" className={labelCls}>
          Isi pengumuman
        </label>
        <textarea
          id="isi"
          className={`${inputCls} min-h-32`}
          value={form.isi}
          onChange={(e) => ubah("isi", e.target.value)}
          placeholder="Tulis isi pengumuman di sini…"
          required
          maxLength={5000}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="target" className={labelCls}>
            Ditujukan kepada
          </label>
          <select
            id="target"
            className={inputCls}
            value={form.target}
            onChange={(e) => ubah("target", e.target.value)}
            disabled={targetTerkunciDojo}
          >
            {!targetTerkunciDojo && <option value="SEMUA">Semua</option>}
            <option value="DOJO">Dojo tertentu</option>
            {!targetTerkunciDojo && <option value="SENSEI">Sensei</option>}
          </select>
          {targetTerkunciDojo && (
            <p className="mt-1 text-xs text-slate-500">
              Admin dojo hanya dapat mengumumkan untuk dojonya sendiri.
            </p>
          )}
        </div>

        {form.target === "DOJO" && !targetTerkunciDojo && (
          <div>
            <label htmlFor="dojoId" className={labelCls}>
              Dojo
            </label>
            <select
              id="dojoId"
              className={inputCls}
              value={form.dojoId}
              onChange={(e) => ubah("dojoId", e.target.value)}
              required
            >
              <option value="">Pilih dojo…</option>
              {dojoList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="tanggalMulai" className={labelCls}>
            Tayang mulai (opsional)
          </label>
          <input
            id="tanggalMulai"
            type="date"
            className={inputCls}
            value={form.tanggalMulai}
            onChange={(e) => ubah("tanggalMulai", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tanggalSelesai" className={labelCls}>
            Tayang sampai (opsional)
          </label>
          <input
            id="tanggalSelesai"
            type="date"
            className={inputCls}
            value={form.tanggalSelesai}
            onChange={(e) => ubah("tanggalSelesai", e.target.value)}
          />
        </div>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5 rounded accent-dojo-700"
          checked={form.isActive}
          onChange={(e) => ubah("isActive", e.target.checked)}
        />
        Aktif (tampil untuk penerima)
      </label>

      {galat && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {galat}
        </p>
      )}

      <button
        type="submit"
        disabled={menyimpan}
        className="min-h-[48px] w-full rounded-xl bg-dojo-700 px-6 text-base font-bold text-white disabled:opacity-60 sm:w-auto"
      >
        {menyimpan ? "Menyimpan…" : mode === "tambah" ? "Buat Pengumuman" : "Simpan Perubahan"}
      </button>
    </form>
  );
}
