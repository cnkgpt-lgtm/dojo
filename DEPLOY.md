# Panduan Deploy DojoKu ke Vercel

Panduan ini membawa aplikasi **DojoKu — Aplikasi Manajemen Member Karate & Dojo** dari folder ini sampai live di Vercel.

**Yang dibutuhkan:**
1. Akun GitHub
2. Akun Vercel (login dengan GitHub)
3. Database PostgreSQL gratis — [Neon](https://neon.tech) (disarankan)
4. Aplikasi `psql` di komputer (untuk menjalankan 3 file migrasi manual — ikut paket PostgreSQL)

> Catatan: foto (profil, selfie absensi, bukti transfer) saat ini tersimpan lokal di server. Filesystem Vercel bersifat ephemeral (hilang saat redeploy) — untuk produksi serius, pindahkan ke object storage (mis. Cloudflare R2/S3) setelah deploy pertama.

---

## Langkah 1 — Buat repository GitHub (dilakukan Bapak)

1. Buka [github.com/new](https://github.com/new).
2. Repository name: `dojoku`, pemilik: `cnkgpt-lgtm`.
3. **Jangan** centang "Add a README", "Add .gitignore", atau "Choose a license".
4. Klik **Create repository**. Biarkan halaman instruksinya terbuka — jangan push apa pun sendiri.

## Langkah 2 — Push kode (dilakukan asisten)

Setelah repository di Langkah 1 ada, asisten menjalankan push dari folder ini:

```bash
git remote add origin https://github.com/cnkgpt-lgtm/dojoku.git
```

```bash
git push -u origin main
```

> Kode sudah di-commit lokal per phase (7 commit). Push dilakukan asisten setelah Bapak konfirmasi repository sudah dibuat.

## Langkah 3 — Buat database Neon (dilakukan Bapak)

1. Buka [neon.tech](https://neon.tech) → buat project baru (mis. `dojoku`), region terdekat (Singapore).
2. Di dashboard project → **Connection Details**, salin dua connection string:
   - **Pooled** (ada tulisan `-pooler` di host) → untuk `DATABASE_URL`
   - **Direct** (tanpa `-pooler`) → untuk `DIRECT_URL`
3. Simpan keduanya — dipakai di Langkah 4 dan 5.

## Langkah 4 — Import ke Vercel & isi Environment Variables

1. Buka [vercel.com/new](https://vercel.com/new), pilih repository `dojoku` → **Import**.
2. Framework Preset otomatis terdeteksi **Next.js**. Build Command sudah diatur di `vercel.json` (`prisma generate && next build`) — biarkan.
3. **Jangan deploy dulu** — buka **Environment Variables**, isi untuk **Production**:

| Nama | Cara isi |
|---|---|
| `DATABASE_URL` | Connection string **pooled** Neon dari Langkah 3 |
| `DIRECT_URL` | Connection string **direct** Neon dari Langkah 3 (untuk migrasi) |
| `NEXTAUTH_SECRET` | String acak. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Kosongkan dulu — diisi setelah deploy pertama (Langkah 7) |
| `CRON_SECRET` | String acak lain, mis. hasil `openssl rand -base64 32` |

4. Klik **Deploy**. Tunggu sampai status **Ready** — deploy pertama ini hanya untuk mendapatkan URL produksi.

## Langkah 5 — Siapkan database (dari komputer, sekali saja)

Di folder `dojo-karate` ini, buat file `.env` berisi dua baris dari Langkah 3:

```bash
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/dojoku?sslmode=require"
```

```bash
DIRECT_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/dojoku?sslmode=require"
```

Lalu bentuk tabel (satu perintah):

```bash
npx prisma db push
```

**Wajib:** jalankan 3 file migrasi manual berikut SATU PER SATU via `psql` (karena `db push` tidak membuat *partial unique index* — tanpa ini, pengaman anti-duplikat pembayaran & pengingat hanya mengandalkan kode):

```bash
psql "$DIRECT_URL" -f prisma/migrations/20261008_phase4_finance/migration.sql
```

```bash
psql "$DIRECT_URL" -f prisma/migrations/20261008_phase6_sabuk_penilaian/migration.sql
```

```bash
psql "$DIRECT_URL" -f prisma/migrations/20261008_phase7_komunikasi/migration.sql
```

## Langkah 6 — Seed data demo (sekali saja)

Masih dari folder yang sama (`.env` sudah menunjuk ke Neon):

```bash
npm run db:seed
```

Ini membuat: 1 organisasi demo, 2 dojo (Makassar), tarif default Rp100.000, tingkatan sabuk Putih–Hitam, dan akun demo di bawah.

## Langkah 7 — Isi NEXTAUTH_URL & redeploy

1. Salin URL produksi dari dashboard Vercel, mis. `https://dojoku.vercel.app`.
2. Di Vercel → **Settings → Environment Variables** → isi `NEXTAUTH_URL` dengan URL itu (tanpa trailing slash).
3. Buka tab **Deployments** → **Redeploy** deployment terakhir (tanpa cache bila perlu).

## Langkah 8 — Verifikasi

1. Buka URL produksi → halaman login muncul.
2. Login dengan akun demo (password: `demo1234`):
   - Admin: `admin@dojoku.demo`
   - Sensei: `sensei@dojoku.demo`
   - Siswa: `ahmad@dojoku.demo`
3. Cek tiap role: admin bisa buka semua menu; sensei tidak bisa buka menu Keuangan/Pembayaran; siswa hanya melihat datanya sendiri.
4. **Segera ganti password / nonaktifkan akun demo** setelah membuat akun asli.
5. Cek **Vercel → Cron Jobs**: dua jadwal harus terdaftar —
   - `/api/cron/tagihan` tiap `5 16 * * *` (= 00:05 WITA)
   - `/api/cron/pengingat-iuran` tiap `0 23 * * *` (= 07:00 WITA)

> ⚠️ Vercel Cron hanya tersedia di plan yang mendukung. Bila plan Bapak tidak mendukung, alternatif: penjadwal eksternal gratis (mis. cron-job.org) yang memanggil `POST https://DOMAIN_ANDA/api/cron/tagihan` dan `/api/cron/pengingat-iuran` dengan header `Authorization: Bearer ISI_CR0N_SECRET_ANDA` pada jam yang sama.

---

## Akun demo

| Role | Email | Password |
|---|---|---|
| Admin | `admin@dojoku.demo` | `demo1234` |
| Sensei | `sensei@dojoku.demo` | `demo1234` |
| Siswa | `ahmad@dojoku.demo` | `demo1234` |

> **Peringatan:** akun ini untuk uji coba. Di produksi, segera ganti passwordnya atau nonaktifkan setelah akun asli dibuat. Jangan pakai password `demo1234` untuk akun sungguhan.

---

## Troubleshooting

| Gejala | Penyebab umum & solusi |
|---|---|
| Build gagal `P1001` / koneksi DB | `DATABASE_URL` salah atau belum diset di Vercel → periksa Langkah 4 |
| Login selalu gagal | `NEXTAUTH_SECRET` belum diisi, atau seed (Langkah 6) belum dijalankan |
| Redirect login berputar-putar | `NEXTAUTH_URL` belum diisi dengan URL produksi → Langkah 7 |
| Cron 401 "Tidak diotorisasi" | `CRON_SECRET` di Vercel tidak sama dengan yang dipakai penjadwal |
| Cron 500 "CRON_SECRET belum dikonfigurasi" | `CRON_SECRET` belum diset di Vercel → tambah lalu redeploy |
| Error duplikat saat pembayaran/pengingat | 3 file migrasi manual (Langkah 5) belum dijalankan via `psql` |
| Upload foto gagal di Vercel | Wajar — filesystem Vercel ephemeral; foto lokal hanya untuk development. Rencanakan pindah ke R2/S3 |
| Tabel tidak ada saat seed | `npx prisma db push` (Langkah 5) belum dijalankan dengan `.env` yang benar |

---

**Checklist go-live:** akun demo diganti/dinonaktifkan ☐ · `NEXTAUTH_URL` terisi URL produksi ☐ · 3 migrasi manual via psql sudah jalan ☐ · cron terdaftar/penjadwal eksternal aktif ☐ · rencana pindah foto ke R2/S3 ☐
