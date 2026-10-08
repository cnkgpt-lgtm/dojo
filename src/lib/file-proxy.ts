import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  isTelegramFileRef,
  telegramFileIdFromRef,
  telegramDirectDownloadUrl,
  telegramStorageConfigured,
} from "./telegram-storage";

/**
 * Penyajian file bukti/selfie lewat proxy server-side (token bot tak pernah
 * terekspos ke browser). Mendukung dua backend ref:
 * - "tg:<file_id>" → stream dari Telegram
 * - "/uploads/..." → baca dari disk lokal
 * Content-Type dideteksi dari magic bytes agar tampil inline di browser
 * (Telegram selalu mengirim application/octet-stream).
 */

// Deteksi tipe file dari magic bytes.
function sniffContentType(buf: Uint8Array): { type: string; ext: string } | null {
  const h = (i: number) => buf[i];
  if (h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47)
    return { type: "image/png", ext: "png" };
  if (h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (
    h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 &&
    h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50
  )
    return { type: "image/webp", ext: "webp" };
  if (h(0) === 0x25 && h(1) === 0x50 && h(2) === 0x44 && h(3) === 0x46)
    return { type: "application/pdf", ext: "pdf" };
  return null;
}

/** Ambil bytes file dari ref (Telegram atau lokal). Kembalikan null bila tak ditemukan. */
export async function ambilBytesFile(ref: string): Promise<Buffer | null> {
  const viaTelegram = isTelegramFileRef(ref);
  if (viaTelegram) {
    if (!telegramStorageConfigured()) return null;
    const downloadUrl = await telegramDirectDownloadUrl(telegramFileIdFromRef(ref));
    const res = await fetch(downloadUrl);
    if (!res.ok || !res.body) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  // Lokal: hanya path /uploads/... yang diizinkan (cegah path traversal).
  if (!ref.startsWith("/uploads/")) return null;
  try {
    return await readFile(join(process.cwd(), "public", ref));
  } catch {
    return null;
  }
}

/** Sajikan file sebagai response inline. Untuk dipakai API route proxy. */
export async function sajikanFile(
  ref: string | null | undefined,
  namaDasar: string
): Promise<NextResponse> {
  if (!ref) return NextResponse.json({ error: "FILE_TIDAK_ADA" }, { status: 404 });
  let bytes: Buffer | null;
  try {
    bytes = await ambilBytesFile(ref);
  } catch (e) {
    console.error("Gagal mengambil file:", e);
    return NextResponse.json({ error: "FILE_GAGAL_DIMUAT" }, { status: 502 });
  }
  if (!bytes) return NextResponse.json({ error: "FILE_TIDAK_DITEMUKAN" }, { status: 404 });

  const sniffed = sniffContentType(bytes);
  // Salin ke buffer baru agar tipenya Uint8Array<ArrayBuffer> (BodyInit).
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new NextResponse(body, {
    headers: {
      "Content-Type": sniffed?.type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${namaDasar}${sniffed ? `.${sniffed.ext}` : ""}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
