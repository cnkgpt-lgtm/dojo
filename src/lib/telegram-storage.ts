// Penyimpanan file via Telegram — alternatif gratis tanpa kartu kredit.
// Cara kerja: bot mengirim file ke channel/group pribadi, database menyimpan
// referensi "tg:<file_id>". Pengguna melihat file lewat API proxy aplikasi
// (token bot tidak pernah terekspos ke browser). Bila bot belum dikonfigurasi,
// aplikasi fallback ke penyimpanan lokal (lihat lib/upload.ts: simpanFile).
// Diadaptasi dari pola RTKu yang terbukti.

const TG_API = "https://api.telegram.org";

export function telegramStorageConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_STORAGE_CHAT_ID);
}

export function isTelegramFileRef(url: string | null | undefined): boolean {
  return !!url && url.startsWith("tg:");
}

export function telegramFileIdFromRef(ref: string): string {
  return ref.slice(3);
}

// Upload file ke chat/channel Telegram; kembalikan referensi "tg:<file_id>".
// Pakai sendDocument agar semua tipe file (foto/PDF) tersimpan utuh apa adanya.
export async function uploadKeTelegram(
  file: File,
  namaFile: string,
  caption?: string
): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_STORAGE_CHAT_ID!;

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", file, namaFile);
  if (caption) form.append("caption", caption.slice(0, 1024));

  const res = await fetch(`${TG_API}/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => null);
  const fileId: string | undefined = data?.result?.document?.file_id;
  if (!data?.ok || !fileId) {
    throw new Error(`TELEGRAM_UPLOAD_GAGAL: ${data?.description ?? `HTTP ${res.status}`}`);
  }
  return `tg:${fileId}`;
}

// Bangun URL unduh langsung Telegram dari file_id.
// HANYA dipakai server-side — URL-nya mengandung token bot yang rahasia.
export async function telegramDirectDownloadUrl(fileId: string): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const res = await fetch(`${TG_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const data = await res.json().catch(() => null);
  const filePath: string | undefined = data?.result?.file_path;
  if (!data?.ok || !filePath) {
    throw new Error(`TELEGRAM_GETFILE_GAGAL: ${data?.description ?? `HTTP ${res.status}`}`);
  }
  return `${TG_API}/file/bot${token}/${filePath}`;
}
