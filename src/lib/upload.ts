import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import {
  telegramStorageConfigured,
  isTelegramFileRef,
  uploadKeTelegram,
} from "./telegram-storage";

/**
 * Penyimpanan foto: Telegram dulu (bila bot dikonfigurasi), fallback lokal
 * public/uploads/<tipe>/ (§46 proteksi upload).
 * KETERBATASAN storage lokal: hilang saat redeploy — sambungkan Telegram
 * agar file tersimpan permanen (lihat badge di halaman verifikasi/monitor).
 */

const MAKS_UKURAN = 2 * 1024 * 1024; // 2MB

type JenisFoto = "jpg" | "png" | "webp";
export type TipeUpload = "siswa" | "sensei" | "profil" | "absensi" | "bukti" | "sabuk";

/** Validasi magic bytes, bukan ekstensi dari client. */
function deteksiJenis(buf: Buffer): JenisFoto | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return "png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return "webp";
  return null;
}

export async function simpanFoto(
  file: File,
  tipe: TipeUpload
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const valid = await bacaDanValidasi(file);
  if (!valid.ok) return valid;
  const url = await simpanBufferLokal(valid.buf, valid.jenis, tipe);
  return { ok: true, url };
}

export type ViaSimpan = "telegram" | "lokal";

/**
 * Simpan file dengan strategi Telegram-dulu: coba upload ke Telegram bila
 * bot dikonfigurasi; bila gagal atau belum dikonfigurasi, fallback ke lokal.
 * Kembalikan ref apa adanya ("tg:<file_id>" atau "/uploads/...") + via.
 * Kolom DB menyimpan ref tanpa perlu tahu backend-nya (tanpa ubah skema).
 */
export async function simpanFile(
  file: File,
  tipe: TipeUpload,
  namaFile: string,
  caption?: string
): Promise<{ ok: true; ref: string; via: ViaSimpan } | { ok: false; error: string }> {
  const valid = await bacaDanValidasi(file);
  if (!valid.ok) return valid;

  if (telegramStorageConfigured()) {
    try {
      const ref = await uploadKeTelegram(valid.file, namaFile, caption);
      return { ok: true, ref, via: "telegram" };
    } catch (e) {
      // Fallback lokal — jangan gagalkan alur utama (absensi/pembayaran).
      console.error("Upload Telegram gagal, fallback ke lokal:", e);
    }
  }
  const url = await simpanBufferLokal(valid.buf, valid.jenis, tipe);
  return { ok: true, ref: url, via: "lokal" };
}

/** Hapus file dari backend-nya: lokal dihapus, ref Telegram diabaikan (tak bisa dihapus via Bot API). */
export async function hapusFile(ref: string | null | undefined): Promise<void> {
  if (!ref || isTelegramFileRef(ref)) return;
  await hapusFotoLama(ref);
}

/** Validasi ukuran + magic bytes, kembalikan buffer siap simpan. */
async function bacaDanValidasi(
  file: File
): Promise<
  | { ok: true; buf: Buffer; jenis: JenisFoto; file: File }
  | { ok: false; error: string }
> {
  if (file.size === 0) return { ok: false, error: "File foto kosong." };
  if (file.size > MAKS_UKURAN) return { ok: false, error: "Ukuran foto maksimal 2MB." };

  const buf = Buffer.from(await file.arrayBuffer());
  const jenis = deteksiJenis(buf);
  if (!jenis) return { ok: false, error: "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP." };
  return { ok: true, buf, jenis, file };
}

async function simpanBufferLokal(buf: Buffer, jenis: JenisFoto, tipe: TipeUpload): Promise<string> {
  const dir = join(process.cwd(), "public", "uploads", tipe);
  await mkdir(dir, { recursive: true });
  const nama = `${randomUUID()}.${jenis}`;
  await writeFile(join(dir, nama), buf);
  return `/uploads/${tipe}/${nama}`;
}

/** Hapus file lama saat foto diganti. Gagal diabaikan (best effort). */
export async function hapusFotoLama(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  try {
    await unlink(join(process.cwd(), "public", url));
  } catch {
    // abaikan
  }
}
