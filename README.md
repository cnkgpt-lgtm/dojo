# DojoKu — Sistem Manajemen Member Karate & Dojo

Scaffold **Phase 1 (Foundation)** sesuai PRD: Database, Authentication, Role, Dojo, User.

## Menjalankan lokal

```bash
npm install
cp .env.example .env
# isi DATABASE_URL (PostgreSQL), NEXTAUTH_SECRET, NEXTAUTH_URL di .env
npx prisma migrate dev --name init   # atau: npx prisma db push
npm run db:seed                      # data demo (idempoten)
npm run dev                          # http://localhost:3000
```

Catatan:

- `NEXTAUTH_SECRET`: generate dengan `openssl rand -base64 32`.
- Tidak ada database eksternal yang dibuat scaffold ini; semua env-driven.

## Akun demo (password: `demo1234`)

| Role   | Login (HP)     | Email                |
|--------|----------------|----------------------|
| Admin  | 081100000001   | admin@dojoku.demo    |
| Sensei | 081100000002   | sensei@dojoku.demo   |
| Siswa  | 081100000011   | ahmad@dojoku.demo    |
| Siswa  | 081100000012   | budi@dojoku.demo     |

Siswa demo: KRT-000001 (Ahmad Fauzi) dan KRT-000002 (Budi Santoso), Dojo Panakkukang.
Login bisa pakai nomor HP **atau** email.

## Struktur

```
prisma/
  schema.prisma   # seluruh entity PRD §57, relasi §58, aturan §59
  seed.ts         # 1 organisasi, 2 dojo, admin/sensei/siswa demo, 1 jadwal
src/
  auth.ts         # NextAuth v5 credentials (HP/email + bcrypt), sesi JWT
  middleware.ts   # cek cookie sesi (Edge-ringan); redirect /login
  lib/
    db.ts         # PrismaClient singleton
    authz.ts      # wajibLogin, wajibRole, filterScopeDojo
  app/
    login/        # halaman masuk (Bahasa Indonesia)
    lupa-password/# arahan hubungi admin dojo
    dashboard/    # shell + dashboard per role (admin/sensei/siswa)
```

## Yang sudah ada (Phase 1–7, MVP lengkap)

- **Phase 1:** schema lengkap (28 tabel §57), auth NextAuth v5 (HP/email + bcrypt),
  sesi JWT + sessionVersion, guard per-role, middleware, dashboard per role.
- **Phase 2:** CRUD siswa & sensei (admin), profil per role, Member ID otomatis
  KRT-XXXXXX, upload foto (magic bytes, 2MB), audit log.
- **Phase 3:** CRUD jadwal, absensi selfie + GPS dengan validasi server
  (jendela jadwal zona WITA, radius haversine, anti-duplikat), monitor + koreksi admin.
- **Phase 4 (Finance):**
  - Tarif iuran fleksibel: khusus siswa > per dojo > default organisasi (§18),
    dengan hari jatuh tempo 1–28 per tarif.
  - Generate tagihan bulanan idempoten (`POST /api/tagihan/generate`), plus
    endpoint cron `POST /api/cron/tagihan` (proteksi `CRON_SECRET`, lihat di bawah).
  - Status TERLAMBAT dihitung dinamis saat baca (zona WITA), tanpa cron.
  - Pembayaran tunai (admin, nominal harus pas, langsung LUNAS) dan transfer
    (siswa, upload bukti wajib) dengan anti-duplikat (partial unique index +
    guard atomik).
  - Verifikasi admin: APPROVE → LUNAS + revenue "Iuran Bulanan" tercatat dalam
    transaksi yang sama; REJECT → alasan wajib.
  - Tunggakan per siswa, riwayat pembayaran, notifikasi in-app
    (tagihan baru, pembayaran diterima/diverifikasi/ditolak).
  - Migrasi manual: `prisma/migrations/20261008_phase4_finance/migration.sql`
    (kolom `FeeSetting.hariJatuhTempo`, `Revenue.paymentId` unique,
    partial unique index anti-duplikat pembayaran aktif).
- **Phase 5 (Reporting):** CRUD pemasukan & pengeluaran + kategori, saldo
  real-time (pemasukan − pengeluaran), laporan keuangan (filter + cetak),
  laporan iuran matriks siswa × bulan, dashboard admin live (10 kartu §37).
  Entri iuran otomatis dari pembayaran dikunci agar tak diubah manual.
- **Phase 6 (Karate Development):** master sabuk configurable, kenaikan sabuk
  (validasi naik tingkat, transaksi atomik + notifikasi), penilaian 8 aspek
  oleh sensei (skala ANGKA/LABEL configurable), halaman Perkembangan siswa,
  profil siswa lengkap. Migrasi manual:
  `prisma/migrations/20261008_phase6_sabuk_penilaian/migration.sql`.
- **Phase 7 (Communication):** pengumuman multi-target (SEMUA/DOJO/SENSEI,
  rentang tayang), endpoint cron pengingat iuran H-7/H-1/H-0 (idempoten),
  notifikasi perubahan jadwal ke siswa dojo. Migrasi manual:
  `prisma/migrations/20261008_phase7_komunikasi/migration.sql`
  (kolom `Announcement.target/tanggalMulai/tanggalSelesai/isActive`,
  `Notification.refId` + unique idempotensi).

## Scheduler otomatis (§67)

Aplikasi tidak memasang cron sendiri. Saat deploy (mis. Vercel Cron), jadwalkan
dua endpoint berikut. Keduanya diproteksi `CRON_SECRET` via header
`Authorization: Bearer <CRON_SECRET>` dan fail-closed bila secret belum diset.

```bash
# 1) Tagihan bulanan — 1x sehari pukul 00:05 WITA.
#    Vercel Cron memakai UTC: 00:05 WITA = 16:05 UTC hari sebelumnya.
#    Cron: 5 16 * * *  →  POST https://<domain-anda>/api/cron/tagihan
curl -X POST https://<domain-anda>/api/cron/tagihan \
  -H "Authorization: Bearer $CRON_SECRET"

# 2) Pengingat iuran H-7 / H-1 / hari jatuh tempo (§25) — 1x sehari pukul 07:00 WITA.
#    07:00 WITA = 23:00 UTC hari sebelumnya.
#    Cron: 0 23 * * *  →  POST https://<domain-anda>/api/cron/pengingat-iuran
curl -X POST https://<domain-anda>/api/cron/pengingat-iuran \
  -H "Authorization: Bearer $CRON_SECRET"
```

Catatan:

- `/api/cron/tagihan` memakai fungsi generate yang sama dengan tombol manual di
  `/dashboard/tagihan`; idempoten (aman bila terpanggil ganda).
- `/api/cron/pengingat-iuran` hanya mengirim ke invoice BELUM_BAYAR milik siswa
  AKTIF yang punya akun login, dengan jatuh tempo tepat H-7 / H-1 / hari ini
  (zona WITA). Idempoten via unique `(userId, tipe, refId)` pada Notification:
  pemanggilan ulang di hari yang sama menghasilkan 0 kiriman baru.
- Status TERLAMBAT dihitung dinamis saat baca (zona WITA) — tidak perlu cron
  dan tidak ada flag tersimpan (§67 "menandai tagihan terlambat").
- `CRON_SECRET` wajib diisi di env (lihat `.env.example`); tanpa itu kedua
  endpoint menolak (fail-closed).

## Belum dikerjakan (Versi 2, PRD §52)

- Phase 7 selesai — MVP lengkap (7 phase).
- V2: riwayat sabuk lanjutan sudah ada; yang ditunda: sertifikat digital,
  export Excel/PDF, grafik analitik, face recognition & liveness detection,
  push notification, rekap prestasi siswa.
