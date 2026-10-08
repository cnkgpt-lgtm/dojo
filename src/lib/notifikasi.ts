import { prisma } from "./db";

/** Tipe notifikasi in-app (§43). */
export type TipeNotifikasi = "JADWAL" | "IURAN" | "PEMBAYARAN" | "PENGUMUMAN" | "SABUK" | "PENILAIAN";

/**
 * Buat notifikasi in-app untuk satu user (§25, §43).
 * Best-effort: kegagalan tidak menggagalkan operasi utama.
 */
export async function kirimNotifikasi(
  userId: string | null | undefined,
  judul: string,
  isi: string,
  tipe: TipeNotifikasi
): Promise<void> {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: { userId, judul, isi, tipe },
    });
  } catch {
    // abaikan: notifikasi tidak boleh menggagalkan operasi utama
  }
}

/**
 * Kirim notifikasi ke SEMUA siswa AKTIF di sebuah dojo yang punya akun login (§43).
 * Best-effort: dipakai untuk kabar perubahan jadwal. Tidak menggagalkan operasi utama.
 */
export async function kirimNotifikasiSiswaDojo(
  dojoId: string,
  judul: string,
  isi: string,
  tipe: TipeNotifikasi
): Promise<number> {
  try {
    const siswa = await prisma.student.findMany({
      where: { dojoId, status: "AKTIF", userId: { not: null }, user: { isActive: true } },
      select: { userId: true },
    });
    const userIds = [...new Set(siswa.map((s) => s.userId).filter((id): id is string => !!id))];
    if (userIds.length === 0) return 0;
    const hasil = await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, judul, isi, tipe })),
    });
    return hasil.count;
  } catch {
    return 0;
  }
}
