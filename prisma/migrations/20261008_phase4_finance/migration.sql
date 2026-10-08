-- Migrasi manual Phase 4 (Finance): perubahan aditif pada skema.
--
-- CATATAN PENTING: proyek ini memakai `prisma db push` (bukan `migrate deploy`),
-- sehingga file ini TIDAK diterapkan otomatis. Kolom baru (1 & 2) dibuat oleh
-- `db push` dari schema.prisma. Bagian 3 (partial unique index) adalah
-- hardening tambahan di level database — terapkan manual via:
--   psql $DATABASE_URL -f prisma/migrations/20261008_phase4_finance/migration.sql
-- Aplikasi tetap aman tanpa index ini karena anti-duplikat juga ditegakkan
-- di kode via SELECT ... FOR UPDATE di dalam transaksi.

-- 1. Tarif: tanggal jatuh tempo 1–28 per tarif (§18).
ALTER TABLE "FeeSetting" ADD COLUMN IF NOT EXISTS "hariJatuhTempo" INTEGER NOT NULL DEFAULT 10;

-- 2. Revenue: tautan balik ke Payment agar satu pembayaran hanya membentuk satu pemasukan (§49 anti-duplikat).
ALTER TABLE "Revenue" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Revenue_paymentId_key'
  ) THEN
    ALTER TABLE "Revenue" ADD CONSTRAINT "Revenue_paymentId_key" UNIQUE ("paymentId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Revenue_paymentId_fkey'
  ) THEN
    ALTER TABLE "Revenue"
      ADD CONSTRAINT "Revenue_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Anti-duplikat pembayaran aktif per tagihan (§60 "Pembayaran ganda"):
--    satu invoice hanya boleh punya satu Payment berstatus MENUNGGU_VERIFIKASI atau LUNAS.
--    Pembayaran DITOLAK boleh dicoba ulang (tidak masuk indeks parsial ini).
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_invoiceId_aktif"
  ON "Payment"("invoiceId")
  WHERE "status" IN ('MENUNGGU_VERIFIKASI', 'LUNAS');
