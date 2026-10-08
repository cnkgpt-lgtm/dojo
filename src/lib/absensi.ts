import type { DayOfWeek } from "@prisma/client";

/**
 * Aturan validasi absensi Phase 3 (§13–§17, §59.2–7, §60).
 * SEMUA validasi penentu (jadwal aktif, GPS, duplikat) dijalankan di server.
 * Jangan pernah memercayai hasil perhitungan dari client.
 */

/** Zona waktu operasional DojoKu. Jangan pakai waktu server mentah. */
export const TIMEZONE = "Asia/Makassar";

/** Absensi dibuka N menit sebelum jamMulai — nilai default bila jadwal tak mengatur. */
export const TOLERANSI_BUKA_DEFAULT = 30;

/**
 * Batas keterlambatan: absen lebih dari N menit setelah jamMulai
 * tetapi masih dalam jam latihan => status TERLAMBAT.
 */
export const TOLERANSI_TERLAMBAT_MENIT = 15;

export type WaktuMakassar = {
  /** Tengah hari UTC pada tanggal Makassar — aman untuk kolom @db.Date. */
  tanggal: Date;
  /** "YYYY-MM-DD" menurut zona Makassar. */
  tanggalStr: string;
  hari: DayOfWeek;
  /** Menit sejak 00:00 Makassar. */
  menit: number;
  /** Waktu aktual absensi (kolom jam). */
  jam: Date;
};

const PETA_HARI: Record<string, DayOfWeek> = {
  Mon: "SENIN",
  Tue: "SELASA",
  Wed: "RABU",
  Thu: "KAMIS",
  Fri: "JUMAT",
  Sat: "SABTU",
  Sun: "MINGGU",
};

/** Waktu "sekarang" menurut zona Asia/Makassar. */
export function sekarangMakassar(d: Date = new Date()): WaktuMakassar {
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const ambil = (tipe: string) => bagian.find((p) => p.type === tipe)?.value ?? "";
  const tahun = Number(ambil("year"));
  const bulan = Number(ambil("month"));
  const tanggal = Number(ambil("day"));
  const hari = PETA_HARI[ambil("weekday")] ?? "SENIN";
  const menit = Number(ambil("hour")) * 60 + Number(ambil("minute"));
  const tanggalStr = `${tahun}-${String(bulan).padStart(2, "0")}-${String(tanggal).padStart(2, "0")}`;

  return {
    tanggal: new Date(Date.UTC(tahun, bulan - 1, tanggal, 12, 0, 0)),
    tanggalStr,
    hari,
    menit,
    jam: d,
  };
}

/** "16:30" -> 990. */
export function menitDariJam(jam: string): number {
  const [h, m] = jam.split(":").map(Number);
  return h * 60 + m;
}

export type StatusJendela = "BUKA" | "BELUM_DIBUKA" | "DITUTUP";

/**
 * Apakah absensi sedang dibuka untuk jadwal ini (§15).
 * Jendela: [jamMulai − toleransiMenit, jamSelesai].
 */
export function statusJendela(
  jamMulai: string,
  jamSelesai: string,
  toleransiMenit: number,
  menitSekarang: number
): StatusJendela {
  if (menitSekarang < menitDariJam(jamMulai) - toleransiMenit) return "BELUM_DIBUKA";
  if (menitSekarang > menitDariJam(jamSelesai)) return "DITUTUP";
  return "BUKA";
}

/** HADIR bila absen ≤ 15 menit setelah jamMulai, selebihnya TERLAMBAT (§16). */
export function statusKehadiran(jamMulai: string, menitAbsen: number): "HADIR" | "TERLAMBAT" {
  return menitAbsen <= menitDariJam(jamMulai) + TOLERANSI_TERLAMBAT_MENIT ? "HADIR" : "TERLAMBAT";
}

/** Jarak garis lurus (haversine) dalam meter. */
export function haversineMeter(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
