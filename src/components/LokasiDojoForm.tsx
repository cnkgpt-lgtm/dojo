"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Dojo = {
  id: string;
  nama: string;
  alamat: string;
  latitude: number;
  longitude: number;
  radiusAbsensi: number;
};

const inputCls =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100";

/**
 * Form titik + radius absensi per dojo. Siswa hanya bisa absen bila
 * berada di dalam radius (meter) dari titik ini — validasi di server (§14).
 */
export function LokasiDojoForm({ dojo }: { dojo: Dojo }) {
  const router = useRouter();
  const [lat, setLat] = useState(String(dojo.latitude));
  const [lng, setLng] = useState(String(dojo.longitude));
  const [radius, setRadius] = useState(dojo.radiusAbsensi);
  const [gps, setGps] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [sukses, setSukses] = useState("");

  function lokasiSaya() {
    if (!navigator.geolocation) {
      setGalat("Perangkat tidak mendukung GPS.");
      return;
    }
    setGps(true);
    setGalat("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(6)));
        setLng(String(pos.coords.longitude.toFixed(6)));
        setGps(false);
      },
      () => {
        setGalat("Gagal membaca GPS. Pastikan izin lokasi diberikan.");
        setGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    setSukses("");
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || la < -90 || la > 90) {
      setGalat("Latitude tidak valid (-90 sampai 90).");
      return;
    }
    if (!Number.isFinite(lo) || lo < -180 || lo > 180) {
      setGalat("Longitude tidak valid (-180 sampai 180).");
      return;
    }
    setSibuk(true);
    try {
      const r = await fetch(`/api/dojo/${dojo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: la, longitude: lo, radiusAbsensi: radius }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGalat(j.error ?? "Gagal menyimpan lokasi.");
        return;
      }
      setSukses(`Tersimpan. Siswa hanya bisa absen dalam radius ${radius} m dari titik ini.`);
      router.refresh();
    } catch {
      setGalat("Terjadi kesalahan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={simpan} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">{dojo.nama}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{dojo.alamat}</p>
        </div>
        <button
          type="button"
          onClick={lokasiSaya}
          disabled={gps}
          className="min-h-[44px] shrink-0 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          {gps ? "Membaca GPS..." : "📍 Lokasi saya"}
        </button>
      </div>

      {galat && (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {galat}
        </p>
      )}
      {sukses && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {sukses}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Latitude</span>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            inputMode="decimal"
            placeholder="-5.1477"
            className={inputCls}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Longitude</span>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            inputMode="decimal"
            placeholder="119.4321"
            className={inputCls}
            required
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold">Radius absensi</span>
          <span className="rounded-full bg-dojo-100 px-3 py-1 text-sm font-extrabold text-dojo-800">
            {radius} m
          </span>
        </div>
        <input
          type="range"
          min={25}
          max={1000}
          step={25}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-label="Radius absensi dalam meter"
          className="w-full accent-green-700"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>25 m</span>
          <span>1000 m</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Siswa di luar {radius} meter dari titik ini akan ditolak dengan pesan "Anda berada di luar
          area latihan."
        </p>
      </div>

      <button
        type="submit"
        disabled={sibuk}
        className="mt-4 min-h-[48px] w-full rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
      >
        {sibuk ? "Menyimpan..." : "Simpan Lokasi"}
      </button>
    </form>
  );
}
