import type { CSSProperties } from "react";
import { prisma } from "./db";

/** Delapan aspek penilaian perkembangan siswa (§35). */
export const ASPEK_PENILAIAN = [
  { key: "kihon", label: "Kihon" },
  { key: "kata", label: "Kata" },
  { key: "kumite", label: "Kumite" },
  { key: "fisik", label: "Fisik" },
  { key: "disiplin", label: "Disiplin" },
  { key: "sikap", label: "Sikap" },
  { key: "kehadiran", label: "Kehadiran" },
  { key: "teknik", label: "Teknik" },
] as const;

export type AspekKey = (typeof ASPEK_PENILAIAN)[number]["key"];

/** Skala penilaian yang bisa dipilih admin (§35). */
export type SkalaPenilaian = "ANGKA" | "LABEL";

const KUNCI_SKALA = "skalaPenilaian";

const LABEL_SKALA: Record<number, string> = {
  1: "Sangat Kurang",
  2: "Kurang",
  3: "Cukup",
  4: "Baik",
  5: "Sangat Baik",
};

/** Ambil skala penilaian aktif; default ANGKA bila belum diatur. */
export async function getSkalaPenilaian(): Promise<SkalaPenilaian> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: KUNCI_SKALA } });
    return s?.value === "LABEL" ? "LABEL" : "ANGKA";
  } catch {
    return "ANGKA";
  }
}

/** Simpan skala penilaian (admin). */
export async function setSkalaPenilaian(skala: SkalaPenilaian): Promise<void> {
  await prisma.setting.upsert({
    where: { key: KUNCI_SKALA },
    update: { value: skala },
    create: { key: KUNCI_SKALA, value: skala },
  });
}

/** Tampilkan nilai 1–5 sesuai skala aktif. */
export function tampilNilai(nilai: number | null | undefined, skala: SkalaPenilaian): string {
  if (nilai == null) return "–";
  if (skala === "LABEL") return LABEL_SKALA[nilai] ?? String(nilai);
  return `${nilai}/5`;
}

/** Rata-rata dari aspek yang terisi (satu desimal), atau null bila kosong. */
export function rataRata(nilai: Record<string, number | null | undefined>): number | null {
  const angka = Object.values(nilai).filter((v): v is number => typeof v === "number");
  if (angka.length === 0) return null;
  return Math.round((angka.reduce((a, b) => a + b, 0) / angka.length) * 10) / 10;
}

/** Warna badge sabuk: pakai warnaHex bila ada, fallback abu-abu. */
export function gayaBadgeSabuk(warnaHex: string | null | undefined): CSSProperties {
  const hex = warnaHex?.trim() || "#64748b";
  return { backgroundColor: hex, color: "#ffffff" };
}
