"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type JadwalAktif = {
  id: string;
  namaLatihan: string;
  jamMulai: string;
  jamSelesai: string;
  jamBuka: string;
  coachNama: string | null;
  jendela: "BUKA" | "BELUM_DIBUKA" | "DITUTUP";
};

type Hasil = { ok: boolean; pesan: string } | null;

/** Haversine di browser — hanya untuk tampilan status GPS; keputusan tetap di server. */
function jarakMeter(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const LABEL_JENDELA: Record<JadwalAktif["jendela"], string> = {
  BUKA: "Absensi dibuka",
  BELUM_DIBUKA: "Belum dibuka",
  DITUTUP: "Sudah ditutup",
};

const WARNA_JENDELA: Record<JadwalAktif["jendela"], string> = {
  BUKA: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  BELUM_DIBUKA: "bg-amber-50 text-amber-700 ring-amber-200",
  DITUTUP: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function AbsensiClient({
  student,
  dojo,
  schedules,
}: {
  student: { nama: string; foto: string | null; memberId: string };
  dojo: { nama: string; latitude: number; longitude: number; radiusAbsensi: number };
  schedules: JadwalAktif[];
}) {
  const [jadwalId, setJadwalId] = useState(schedules.find((s) => s.jendela === "BUKA")?.id ?? "");
  const [posisi, setPosisi] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsGalat, setGpsGalat] = useState("");
  const [kameraAktif, setKameraAktif] = useState(false);
  const [kameraGagal, setKameraGagal] = useState(false);
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<Hasil>(null);
  const [selesaiIds, setSelesaiIds] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // GPS: pantau posisi selama halaman dibuka.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsGalat("Perangkat tidak mendukung GPS.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosisi({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsGalat("");
      },
      () => setGpsGalat("Lokasi tidak dapat ditemukan. Silakan aktifkan GPS."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const hentikanKamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setKameraAktif(false);
  }, []);

  useEffect(() => hentikanKamera, [hentikanKamera]);

  // Pasang stream ke elemen video setelah ia ter-render.
  useEffect(() => {
    const video = videoRef.current;
    if (kameraAktif && video && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => setKameraGagal(true));
    }
  }, [kameraAktif]);

  async function aktifkanKamera() {
    setKameraGagal(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setKameraAktif(true);
    } catch {
      setKameraGagal(true);
    }
  }

  function ambilFoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    const sisi = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Potong persegi dari tengah (cermin agar seperti selfie).
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (video.videoWidth - sisi) / 2,
      (video.videoHeight - sisi) / 2,
      sisi,
      sisi,
      0,
      0,
      canvas.width,
      canvas.height
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setFotoBlob(blob);
        setFotoUrl(URL.createObjectURL(blob));
        hentikanKamera();
      },
      "image/jpeg",
      0.85
    );
  }

  function fotoDariFile(file: File | null) {
    if (!file) return;
    setFotoBlob(file);
    setFotoUrl(URL.createObjectURL(file));
  }

  const jadwalTerpilih = schedules.find((s) => s.id === jadwalId);
  const jarak = posisi
    ? Math.round(jarakMeter(posisi.lat, posisi.lon, dojo.latitude, dojo.longitude))
    : null;
  const dalamRadius = jarak !== null && jarak <= dojo.radiusAbsensi;
  const sudahAbsen = jadwalTerpilih ? selesaiIds.includes(jadwalTerpilih.id) : false;
  const bisaAbsen =
    !!jadwalTerpilih &&
    jadwalTerpilih.jendela === "BUKA" &&
    posisi !== null &&
    dalamRadius &&
    fotoBlob !== null &&
    !sudahAbsen &&
    !mengirim;

  async function kirimAbsensi() {
    if (!bisaAbsen || !jadwalTerpilih || !posisi || !fotoBlob) return;
    setMengirim(true);
    setHasil(null);
    try {
      const form = new FormData();
      form.append("scheduleId", jadwalTerpilih.id);
      form.append("latitude", String(posisi.lat));
      form.append("longitude", String(posisi.lon));
      form.append("foto", fotoBlob, "selfie.jpg");
      const res = await fetch("/api/absensi", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Absensi gagal. Silakan coba lagi.");
      setHasil({ ok: true, pesan: json.message ?? "Absensi berhasil." });
      setSelesaiIds((ids) => [...ids, jadwalTerpilih.id]);
      setFotoBlob(null);
      setFotoUrl("");
    } catch (err) {
      setHasil({ ok: false, pesan: err instanceof Error ? err.message : "Absensi gagal." });
    } finally {
      setMengirim(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Identitas siswa */}
      <section
        aria-label="Identitas siswa"
        className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
      >
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dojo-700 text-base font-extrabold text-white"
        >
          {student.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.foto} alt="" className="h-full w-full object-cover" />
          ) : (
            student.nama.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">{student.nama}</p>
          <p className="text-sm text-slate-500">{student.memberId}</p>
        </div>
      </section>

      {/* Status GPS */}
      <section
        aria-label="Status lokasi"
        aria-live="polite"
        className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Lokasi Anda</p>
          {jarak === null ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
              Mencari lokasi...
            </span>
          ) : dalamRadius ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              Dalam area · {jarak} m
            </span>
          ) : (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
              Di luar area · {jarak} m
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Radius absensi {dojo.nama}: {dojo.radiusAbsensi} meter.
        </p>
        {gpsGalat && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {gpsGalat}
          </p>
        )}
      </section>

      {/* Pilih jadwal */}
      <section aria-label="Pilih jadwal latihan">
        <h2 className="mb-2 text-base font-bold">Pilih jadwal hari ini</h2>
        {schedules.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
            Tidak ada jadwal latihan hari ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {schedules.map((s) => {
              const aktif = s.id === jadwalId;
              const sudah = selesaiIds.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setJadwalId(s.id);
                      setHasil(null);
                    }}
                    aria-pressed={aktif}
                    className={`block w-full rounded-2xl p-4 text-left ring-1 transition ${
                      aktif
                        ? "bg-dojo-50 ring-2 ring-dojo-700"
                        : "bg-slate-50 ring-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold">{s.namaLatihan}</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {s.jamMulai}–{s.jamSelesai} · dibuka {s.jamBuka}
                          {s.coachNama ? ` · Sensei ${s.coachNama}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${WARNA_JENDELA[s.jendela]}`}
                      >
                        {sudah ? "Sudah absen" : LABEL_JENDELA[s.jendela]}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Kamera / selfie */}
      <section aria-label="Foto selfie">
        <h2 className="mb-2 text-base font-bold">Foto selfie</h2>
        {fotoUrl ? (
          <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl} alt="Pratinjau selfie absensi" className="aspect-square w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setFotoBlob(null);
                setFotoUrl("");
              }}
              className="flex min-h-[44px] w-full items-center justify-center bg-slate-50 text-sm font-semibold text-slate-600"
            >
              Ambil ulang foto
            </button>
          </div>
        ) : kameraAktif ? (
          <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-slate-200">
            <video ref={videoRef} playsInline muted className="aspect-square w-full -scale-x-100 object-cover" />
            <div className="flex gap-2 bg-white p-3">
              <button
                type="button"
                onClick={ambilFoto}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-dojo-700 text-sm font-bold text-white"
              >
                Jepret Foto
              </button>
              <button
                type="button"
                onClick={hentikanKamera}
                className="inline-flex min-h-[48px] items-center rounded-xl px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Ambil selfie wajah Anda sebagai bukti kehadiran.
            </p>
            <button
              type="button"
              onClick={aktifkanKamera}
              className="mt-3 inline-flex min-h-[48px] items-center rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white"
            >
              Aktifkan Kamera
            </button>
            {kameraGagal && (
              <p className="mt-2 text-xs text-slate-500">
                Kamera tidak tersedia. Gunakan unggah foto di bawah.
              </p>
            )}
            <div className="mt-3">
              <label
                htmlFor="foto-file"
                className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl px-4 text-sm font-semibold text-dojo-700 ring-1 ring-slate-200"
              >
                Atau unggah foto
              </label>
              <input
                id="foto-file"
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                onChange={(e) => fotoDariFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Tombol utama */}
      <button
        type="button"
        onClick={kirimAbsensi}
        disabled={!bisaAbsen}
        className="min-h-[56px] w-full rounded-2xl bg-dojo-700 text-base font-extrabold text-white disabled:opacity-40"
      >
        {mengirim ? "Mengirim..." : sudahAbsen ? "Sudah Absen" : "AMBIL SELFIE & ABSEN"}
      </button>
      {!bisaAbsen && !sudahAbsen && jadwalTerpilih?.jendela !== "BUKA" && schedules.length > 0 && (
        <p className="text-center text-xs text-slate-500">
          {jadwalTerpilih?.jendela === "BELUM_DIBUKA"
            ? `Absensi jadwal ini dibuka pukul ${jadwalTerpilih.jamBuka}.`
            : "Jadwal yang dipilih sudah ditutup."}
        </p>
      )}
      {!dalamRadius && jarak !== null && (
        <p className="text-center text-xs text-slate-500">
          Anda harus berada dalam radius {dojo.radiusAbsensi} meter dari {dojo.nama}.
        </p>
      )}

      {/* Hasil */}
      {hasil && (
        <div
          role={hasil.ok ? "status" : "alert"}
          className={`rounded-2xl p-5 text-center ring-1 ${
            hasil.ok
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-red-200"
          }`}
        >
          <p className="font-bold">{hasil.pesan}</p>
          {hasil.ok && (
            <Link
              href="/dashboard/absensi/riwayat"
              className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold underline"
            >
              Lihat riwayat kehadiran
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
