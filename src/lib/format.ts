/** Format tampilan khusus DojoKu (id-ID, zona Asia/Makassar). */

export function rupiah(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}

export function formatTanggal(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  }).format(new Date(d));
}

/** Ubah Date menjadi nilai input type="date" (YYYY-MM-DD) tanpa geser zona waktu. */
export function keTanggalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const t = new Date(d);
  const lokal = new Date(t.getTime() - t.getTimezoneOffset() * 60000);
  return lokal.toISOString().slice(0, 10);
}

export const LABEL_STATUS_SISWA: Record<string, string> = {
  AKTIF: "Aktif",
  TIDAK_AKTIF: "Tidak Aktif",
  CUTI: "Cuti",
  KELUAR: "Keluar",
};

export const LABEL_GENDER: Record<string, string> = {
  LAKI_LAKI: "Laki-laki",
  PEREMPUAN: "Perempuan",
};

export const NAMA_HARI: Record<string, string> = {
  SENIN: "Senin",
  SELASA: "Selasa",
  RABU: "Rabu",
  KAMIS: "Kamis",
  JUMAT: "Jumat",
  SABTU: "Sabtu",
  MINGGU: "Minggu",
};

export const LABEL_STATUS_ABSENSI: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
};

export const WARNA_STATUS_ABSENSI: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  TERLAMBAT: "bg-amber-50 text-amber-700 ring-amber-200",
  DITOLAK: "bg-red-50 text-red-700 ring-red-200",
  DIBATALKAN: "bg-slate-100 text-slate-500 ring-slate-200",
};

export const LABEL_STATUS_IURAN: Record<string, string> = {
  BELUM_BAYAR: "Belum Bayar",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  LUNAS: "Lunas",
  DITOLAK: "Ditolak",
  TERLAMBAT: "Terlambat",
  DIBATALKAN: "Dibatalkan",
};

export const WARNA_STATUS_IURAN: Record<string, string> = {
  BELUM_BAYAR: "bg-slate-100 text-slate-600 ring-slate-200",
  MENUNGGU_VERIFIKASI: "bg-amber-50 text-amber-700 ring-amber-200",
  LUNAS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DITOLAK: "bg-red-50 text-red-700 ring-red-200",
  TERLAMBAT: "bg-orange-50 text-orange-700 ring-orange-200",
  DIBATALKAN: "bg-slate-100 text-slate-500 ring-slate-200",
};

export const LABEL_METODE_BAYAR: Record<string, string> = {
  TUNAI: "Tunai",
  TRANSFER: "Transfer",
};

export const LABEL_TIPE_NOTIFIKASI: Record<string, string> = {
  JADWAL: "Jadwal",
  IURAN: "Iuran",
  PEMBAYARAN: "Pembayaran",
  PENGUMUMAN: "Pengumuman",
  SABUK: "Sabuk",
  PENILAIAN: "Penilaian",
};
