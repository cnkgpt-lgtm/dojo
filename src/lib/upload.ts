import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * Penyimpanan foto lokal: public/uploads/<tipe>/ (§46 proteksi upload).
 * KETERBATASAN: storage lokal, pindah ke object storage saat deploy produksi.
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
  if (file.size === 0) return { ok: false, error: "File foto kosong." };
  if (file.size > MAKS_UKURAN) return { ok: false, error: "Ukuran foto maksimal 2MB." };

  const buf = Buffer.from(await file.arrayBuffer());
  const jenis = deteksiJenis(buf);
  if (!jenis) return { ok: false, error: "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP." };

  const dir = join(process.cwd(), "public", "uploads", tipe);
  await mkdir(dir, { recursive: true });
  const nama = `${randomUUID()}.${jenis}`;
  await writeFile(join(dir, nama), buf);
  return { ok: true, url: `/uploads/${tipe}/${nama}` };
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
