"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NAMA_HARI } from "@/lib/format";

type DojoOption = { id: string; nama: string };
type CoachOption = { id: string; nama: string; dojoId: string | null };

const HARI = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"] as const;

export type JadwalAwal = {
  dojoId?: string;
  hari?: string;
  jamMulai?: string;
  jamSelesai?: string;
  coachId?: string | null;
  namaLatihan?: string;
  toleransiMenit?: number;
  isActive?: boolean;
};

const inputCls =
  "mt-1 block w-full rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-dojo-700";
const labelCls = "block text-sm font-semibold";

export function JadwalForm({
  mode,
  jadwalId,
  awal,
  dojoList,
  coachList,
}: {
  mode: "tambah" | "ubah";
  jadwalId?: string;
  awal: JadwalAwal;
  dojoList: DojoOption[];
  coachList: CoachOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    dojoId: awal.dojoId ?? "",
    hari: awal.hari ?? "SENIN",
    jamMulai: awal.jamMulai ?? "16:00",
    jamSelesai: awal.jamSelesai ?? "18:00",
    coachId: awal.coachId ?? "",
    namaLatihan: awal.namaLatihan ?? "",
    toleransiMenit: String(awal.toleransiMenit ?? 30),
    isActive: awal.isActive ?? true,
  });
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  const senseiTersedia = coachList.filter(
    (c) => !c.dojoId || !form.dojoId || c.dojoId === form.dojoId
  );

  function ubah<K extends keyof typeof form>(kunci: K, nilai: (typeof form)[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat("");
    try {
      const body = {
        dojoId: form.dojoId,
        hari: form.hari,
        jamMulai: form.jamMulai,
        jamSelesai: form.jamSelesai,
        coachId: form.coachId || null,
        namaLatihan: form.namaLatihan.trim(),
        toleransiMenit: Number(form.toleransiMenit),
        isActive: form.isActive,
      };
      const res = await fetch(mode === "tambah" ? "/api/jadwal" : `/api/jadwal/${jadwalId}`, {
        method: mode === "tambah" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan jadwal.");
      router.push("/dashboard/jadwal");
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan jadwal.");
      setMenyimpan(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 sm:p-6">
      <div>
        <label htmlFor="namaLatihan" className={labelCls}>
          Nama latihan
        </label>
        <input
          id="namaLatihan"
          className={inputCls}
          value={form.namaLatihan}
          onChange={(e) => ubah("namaLatihan", e.target.value)}
          placeholder="mis. Latihan Rutin Sore"
          required
          minLength={3}
          maxLength={100}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
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
            <option value="">Pilih dojo</option>
            {dojoList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hari" className={labelCls}>
            Hari
          </label>
          <select
            id="hari"
            className={inputCls}
            value={form.hari}
            onChange={(e) => ubah("hari", e.target.value)}
          >
            {HARI.map((h) => (
              <option key={h} value={h}>
                {NAMA_HARI[h]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="jamMulai" className={labelCls}>
            Jam mulai
          </label>
          <input
            id="jamMulai"
            type="time"
            className={inputCls}
            value={form.jamMulai}
            onChange={(e) => ubah("jamMulai", e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="jamSelesai" className={labelCls}>
            Jam selesai
          </label>
          <input
            id="jamSelesai"
            type="time"
            className={inputCls}
            value={form.jamSelesai}
            onChange={(e) => ubah("jamSelesai", e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="coachId" className={labelCls}>
            Sensei pengajar <span className="font-normal text-slate-400">(opsional)</span>
          </label>
          <select
            id="coachId"
            className={inputCls}
            value={form.coachId}
            onChange={(e) => ubah("coachId", e.target.value)}
          >
            <option value="">Belum ditentukan</option>
            {senseiTersedia.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="toleransiMenit" className={labelCls}>
            Absensi dibuka (menit sebelum mulai)
          </label>
          <input
            id="toleransiMenit"
            type="number"
            min={0}
            max={180}
            className={inputCls}
            value={form.toleransiMenit}
            onChange={(e) => ubah("toleransiMenit", e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Contoh: 30 berarti absensi dibuka 30 menit sebelum jam mulai.
          </p>
        </div>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => ubah("isActive", e.target.checked)}
          className="h-5 w-5 accent-red-700"
        />
        Jadwal aktif
      </label>

      {galat && (
        <p className="text-sm text-red-600" role="alert">
          {galat}
        </p>
      )}

      <button
        type="submit"
        disabled={menyimpan}
        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
      >
        {menyimpan ? "Menyimpan..." : mode === "tambah" ? "Simpan Jadwal" : "Simpan Perubahan"}
      </button>
    </form>
  );
}
