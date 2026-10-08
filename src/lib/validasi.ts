import { z } from "zod";
import { menitDariJam } from "./absensi";

/** Skema validasi input Phase 2 (Member). Pesan galat Bahasa Indonesia. */

const genderEnum = z.enum(["LAKI_LAKI", "PEREMPUAN"]);
const statusSiswaEnum = z.enum(["AKTIF", "TIDAK_AKTIF", "CUTI", "KELUAR"]);

// --- Dojo (§10) ---------------------------------------------------------------
export const dojoSchema = z.object({
  nama: z.string().trim().min(3, "Nama dojo minimal 3 karakter").max(100, "Nama dojo maksimal 100 karakter"),
  kode: z.string().trim().min(2, "Kode dojo minimal 2 karakter").max(30, "Kode dojo maksimal 30 karakter"),
  alamat: z.string().trim().min(5, "Alamat minimal 5 karakter").max(255, "Alamat maksimal 255 karakter"),
  latitude: z.coerce.number().min(-90, "Latitude tidak valid").max(90, "Latitude tidak valid"),
  longitude: z.coerce.number().min(-180, "Longitude tidak valid").max(180, "Longitude tidak valid"),
  radiusAbsensi: z.coerce
    .number()
    .int("Radius harus bilangan bulat")
    .min(10, "Radius minimal 10 meter")
    .max(2000, "Radius maksimal 2000 meter")
    .default(100),
  kontak: z.string().trim().max(30, "Kontak maksimal 30 karakter").nullish(),
  isActive: z.coerce.boolean().default(true),
});
export const dojoUpdateSchema = dojoSchema.partial();

// --- Siswa (§8). Member ID TIDAK diterima dari client, dibuat di server (§9). --
const baseSiswa = z.object({
  nama: z.string().trim().min(3, "Nama lengkap minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
  dojoId: z.string().min(1, "Dojo wajib dipilih"),
  foto: z.string().trim().max(255).nullish(),
  phone: z.string().trim().min(9, "Nomor HP minimal 9 digit").max(16, "Nomor HP maksimal 16 digit").nullish(),
  email: z.string().trim().email("Format email tidak valid").max(100, "Email maksimal 100 karakter").nullish(),
  alamat: z.string().trim().max(255, "Alamat maksimal 255 karakter").nullish(),
  tempatLahir: z.string().trim().max(100).nullish(),
  tanggalLahir: z.coerce.date().nullish(),
  jenisKelamin: genderEnum.nullish(),
  namaOrangTua: z.string().trim().max(100, "Nama orang tua maksimal 100 karakter").nullish(),
  phoneOrangTua: z.string().trim().max(16, "Nomor HP orang tua maksimal 16 digit").nullish(),
  tanggalBergabung: z.coerce.date().optional(),
  status: statusSiswaEnum.default("AKTIF"),
  sabukId: z.string().nullish(),
  catatan: z.string().trim().max(1000, "Catatan maksimal 1000 karakter").nullish(),
});
export const siswaCreateSchema = baseSiswa;
export const siswaUpdateSchema = baseSiswa.partial();

// --- Sensei (§11) --------------------------------------------------------------
const baseSensei = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
  dojoId: z.string().min(1).nullish(),
  foto: z.string().trim().max(255).nullish(),
  phone: z.string().trim().min(9, "Nomor HP minimal 9 digit").max(16, "Nomor HP maksimal 16 digit").nullish(),
  email: z.string().trim().email("Format email tidak valid").max(100, "Email maksimal 100 karakter").nullish(),
  alamat: z.string().trim().max(255, "Alamat maksimal 255 karakter").nullish(),
  nomorIdentitas: z.string().trim().max(50, "Nomor identitas maksimal 50 karakter").nullish(),
  spesialisasi: z.string().trim().max(100, "Spesialisasi maksimal 100 karakter").nullish(),
  isActive: z.coerce.boolean().default(true),
});
export const senseiCreateSchema = baseSensei;
export const senseiUpdateSchema = baseSensei.partial();

// --- Profil milik sendiri: hanya field aman (§6). Role/dojo/status tak tersentuh. --
export const profilUpdateSchema = z.object({
  foto: z.string().trim().max(255).nullish(),
  phone: z.string().trim().min(9, "Nomor HP minimal 9 digit").max(16, "Nomor HP maksimal 16 digit").nullish(),
  email: z.string().trim().email("Format email tidak valid").max(100, "Email maksimal 100 karakter").nullish(),
  alamat: z.string().trim().max(255, "Alamat maksimal 255 karakter").nullish(),
});

// Admin tanpa profil terhubung boleh ubah identitas dasarnya sendiri (bukan role).
export const profilAdminUpdateSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
  phone: z.string().trim().min(9, "Nomor HP minimal 9 digit").max(16, "Nomor HP maksimal 16 digit"),
  email: z.string().trim().email("Format email tidak valid").max(100, "Email maksimal 100 karakter").nullish(),
});

// --- Jadwal latihan (§12) ---------------------------------------------------------
const hariEnum = z.enum(["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU", "MINGGU"]);
const jamRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const baseJadwal = z.object({
  dojoId: z.string().min(1, "Dojo wajib dipilih"),
  hari: hariEnum,
  jamMulai: z.string().regex(jamRegex, "Format jam mulai harus HH:MM (mis. 16:00)"),
  jamSelesai: z.string().regex(jamRegex, "Format jam selesai harus HH:MM (mis. 18:00)"),
  coachId: z.string().nullish(),
  namaLatihan: z
    .string()
    .trim()
    .min(3, "Nama latihan minimal 3 karakter")
    .max(100, "Nama latihan maksimal 100 karakter"),
  toleransiMenit: z.coerce
    .number()
    .int("Toleransi harus bilangan bulat")
    .min(0, "Toleransi minimal 0 menit")
    .max(180, "Toleransi maksimal 180 menit")
    .default(30),
  isActive: z.coerce.boolean().default(true),
});

// Jam selesai harus lebih besar dari jam mulai (hanya dicek bila keduanya terisi,
// agar skema update parsial tetap lolos).
const cekJam = (d: { jamMulai?: string; jamSelesai?: string }) =>
  !d.jamMulai || !d.jamSelesai || menitDariJam(d.jamSelesai) > menitDariJam(d.jamMulai);
const pesanJam: { message: string; path: string[] } = {
  message: "Jam selesai harus lebih besar dari jam mulai.",
  path: ["jamSelesai"],
};

export const jadwalCreateSchema = baseJadwal.refine(cekJam, pesanJam);
export const jadwalUpdateSchema = baseJadwal.partial().refine(cekJam, pesanJam);

// --- Koreksi absensi oleh admin (§6, §45): status boleh diubah, jejak tidak dihapus. --
export const absensiKoreksiSchema = z.object({
  status: z.enum(["HADIR", "TERLAMBAT", "DIBATALKAN"]),
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").nullish(),
});

// --- Tarif iuran (§18): fleksibel — siswa spesifik ATAU dojo ATAU default organisasi. --
const baseTarif = z.object({
  nama: z.string().trim().min(3, "Nama tarif minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
  nominal: z.coerce.number().int("Nominal harus bilangan bulat").min(1000, "Nominal minimal Rp1.000"),
  dojoId: z.string().min(1).nullish(),
  studentId: z.string().min(1).nullish(),
  hariJatuhTempo: z.coerce
    .number()
    .int("Hari jatuh tempo harus bilangan bulat")
    .min(1, "Hari jatuh tempo minimal 1")
    .max(28, "Hari jatuh tempo maksimal 28")
    .default(10),
  isActive: z.coerce.boolean().default(true),
});

// Tarif hanya boleh untuk satu cakupan: siswa spesifik, dojo, atau default (keduanya kosong).
const cekCakupanTarif = (d: { dojoId?: string | null; studentId?: string | null }) =>
  !(d.dojoId && d.studentId);

export const tarifCreateSchema = baseTarif.refine(cekCakupanTarif, {
  message: "Pilih salah satu cakupan: siswa spesifik ATAU dojo. Kosongkan keduanya untuk tarif default.",
  path: ["dojoId"],
});
export const tarifUpdateSchema = baseTarif.partial().refine(cekCakupanTarif, {
  message: "Pilih salah satu cakupan: siswa spesifik ATAU dojo. Kosongkan keduanya untuk tarif default.",
  path: ["dojoId"],
});

// --- Generate tagihan bulanan (§19) -------------------------------------------------
const periodeRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
export const generateTagihanSchema = z.object({
  periode: z.string().regex(periodeRegex, "Format periode harus YYYY-MM (mis. 2026-11)"),
  dojoId: z.string().min(1, "Dojo tidak valid").nullish(),
});

// --- Pembayaran tunai oleh admin (§21) ---------------------------------------------
export const tunaiSchema = z.object({
  invoiceId: z.string().min(1, "Tagihan wajib dipilih"),
  nominal: z.coerce.number().int("Nominal harus bilangan bulat").min(1000, "Nominal minimal Rp1.000"),
  tanggal: z.coerce.date().nullish(),
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").nullish(),
});

// --- Pembayaran transfer oleh siswa (§22): bukti wajib, divalidasi terpisah --------
export const transferSchema = z.object({
  invoiceId: z.string().min(1, "Tagihan wajib dipilih"),
  nominal: z.coerce.number().int("Nominal harus bilangan bulat").min(1000, "Nominal minimal Rp1.000"),
  tanggal: z.coerce.date({ message: "Tanggal transfer tidak valid" }),
});

// --- Verifikasi pembayaran oleh admin (§22, §59 aturan 8–10) ------------------------
export const verifikasiSchema = z
  .object({
    keputusan: z.enum(["APPROVE", "REJECT"], { message: "Keputusan harus APPROVE atau REJECT" }),
    alasan: z.string().trim().max(500, "Alasan maksimal 500 karakter").nullish(),
  })
  .refine((d) => d.keputusan !== "REJECT" || (d.alasan && d.alasan.length >= 3), {
    message: "Alasan penolakan wajib diisi.",
    path: ["alasan"],
  });

// --- Tandai notifikasi dibaca -------------------------------------------------------
export const notifikasiBacaSchema = z.object({
  id: z.string().min(1).nullish(),
  semua: z.coerce.boolean().default(false),
});

// --- Kategori keuangan (§27, §28) ---------------------------------------------------
export const kategoriSchema = z.object({
  tipe: z.enum(["pemasukan", "pengeluaran"], { message: "Tipe harus pemasukan atau pengeluaran" }),
  nama: z
    .string()
    .trim()
    .min(2, "Nama kategori minimal 2 karakter")
    .max(60, "Nama kategori maksimal 60 karakter"),
});

// --- Pemasukan manual (§27) ---------------------------------------------------------
const baseTransaksi = {
  tanggal: z.coerce.date({ message: "Tanggal tidak valid" }),
  kategoriId: z.string().min(1, "Kategori wajib dipilih"),
  deskripsi: z
    .string()
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(300, "Deskripsi maksimal 300 karakter"),
  nominal: z.coerce
    .number()
    .int("Nominal harus bilangan bulat")
    .min(1000, "Nominal minimal Rp1.000"),
  dojoId: z.string().min(1, "Dojo wajib dipilih"),
};

export const pemasukanSchema = z.object({
  ...baseTransaksi,
  metode: z.enum(["TUNAI", "TRANSFER"], { message: "Metode harus Tunai atau Transfer" }),
});
export const pemasukanUpdateSchema = pemasukanSchema.partial();

// --- Pengeluaran (§28: tanpa metode pembayaran) --------------------------------------
export const pengeluaranSchema = z.object({
  ...baseTransaksi,
  catatan: z.string().trim().max(500, "Catatan maksimal 500 karakter").nullish(),
});
export const pengeluaranUpdateSchema = pengeluaranSchema.partial();

// --- Sabuk (§33, Phase 6) ------------------------------------------------------------
export const HEX_WARNA = /^#[0-9a-fA-F]{6}$/;

export const beltSchema = z.object({
  nama: z.string().trim().min(2, "Nama sabuk minimal 2 karakter").max(30, "Nama sabuk maksimal 30 karakter"),
  urutan: z.coerce.number().int("Urutan harus bilangan bulat").min(1, "Urutan minimal 1").max(99, "Urutan maksimal 99"),
  warnaHex: z
    .string()
    .trim()
    .regex(HEX_WARNA, "Warna harus format hex, contoh #FFFFFF")
    .nullish(),
  deskripsi: z.string().trim().max(255, "Deskripsi maksimal 255 karakter").nullish(),
  isActive: z.coerce.boolean().default(true),
});
export const beltUpdateSchema = beltSchema.partial();

// Kenaikan sabuk (§34): multipart dari form.
export const kenaikanSabukSchema = z.object({
  beltBaruId: z.string().min(1, "Sabuk baru wajib dipilih"),
  tanggal: z.coerce.date({ errorMap: () => ({ message: "Tanggal tidak valid" }) }),
  nilai: z.string().trim().max(50, "Nilai maksimal 50 karakter").nullish(),
  keterangan: z.string().trim().max(500, "Keterangan maksimal 500 karakter").nullish(),
});

// --- Penilaian perkembangan (§35, Phase 6) --------------------------------------------
export const ASPEK_KEYS = [
  "kihon",
  "kata",
  "kumite",
  "fisik",
  "disiplin",
  "sikap",
  "kehadiran",
  "teknik",
] as const;

const nilaiAspek = z.coerce
  .number()
  .int("Nilai harus bilangan bulat")
  .min(1, "Nilai minimal 1")
  .max(5, "Nilai maksimal 5")
  .nullish();

export const penilaianSchema = z.object({
  studentId: z.string().min(1, "Siswa wajib dipilih"),
  periode: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode harus format YYYY-MM, contoh 2026-10"),
  kihon: nilaiAspek,
  kata: nilaiAspek,
  kumite: nilaiAspek,
  fisik: nilaiAspek,
  disiplin: nilaiAspek,
  sikap: nilaiAspek,
  kehadiran: nilaiAspek,
  teknik: nilaiAspek,
  catatan: z.string().trim().max(1000, "Catatan maksimal 1000 karakter").nullish(),
});

export const skalaPenilaianSchema = z.object({
  skala: z.enum(["ANGKA", "LABEL"], { errorMap: () => ({ message: "Skala harus ANGKA atau LABEL" }) }),
});

// --- Pengumuman (§44) --------------------------------------------------------------
export const targetPengumumanEnum = z.enum(["SEMUA", "DOJO", "SENSEI"]);

const basePengumuman = z.object({
  judul: z
    .string()
    .trim()
    .min(5, "Judul minimal 5 karakter")
    .max(150, "Judul maksimal 150 karakter"),
  isi: z
    .string()
    .trim()
    .min(10, "Isi pengumuman minimal 10 karakter")
    .max(5000, "Isi pengumuman maksimal 5000 karakter"),
  target: targetPengumumanEnum.default("SEMUA"),
  dojoId: z.string().min(1).nullish(),
  tanggalMulai: z.coerce.date().nullish(),
  tanggalSelesai: z.coerce.date().nullish(),
  isActive: z.coerce.boolean().default(true),
});

function cekPengumuman(
  d: z.infer<typeof basePengumuman>
): boolean {
  if (d.target === "DOJO" && !d.dojoId) return false;
  if (d.tanggalMulai && d.tanggalSelesai && d.tanggalSelesai < d.tanggalMulai) return false;
  return true;
}

export const pengumumanCreateSchema = basePengumuman.refine(cekPengumuman, {
  message:
    "Target DOJO wajib memilih dojo; tanggal selesai tidak boleh sebelum tanggal mulai.",
});

export const pengumumanUpdateSchema = basePengumuman
  .partial()
  .refine(
    (d) => {
      if (d.target === "DOJO" && !d.dojoId) return false;
      if (d.tanggalMulai && d.tanggalSelesai && d.tanggalSelesai < d.tanggalMulai) return false;
      return true;
    },
    {
      message:
        "Target DOJO wajib memilih dojo; tanggal selesai tidak boleh sebelum tanggal mulai.",
    }
  );
