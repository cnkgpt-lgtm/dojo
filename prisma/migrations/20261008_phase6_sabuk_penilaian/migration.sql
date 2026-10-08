-- Migrasi Phase 6: Sabuk & Penilaian (DojoKu)
-- Diterapkan manual via psql. CATATAN: deploy memakai `prisma db push`,
-- sehingga perubahan ini TIDAK otomatis terbuat — jalankan file ini sekali
-- pada database produksi/staging setelah db push Phase 5.
-- Aman dijalankan ulang (IF NOT EXISTS / pengecualian duplikat).

-- 1) Kolom deskripsi pada Belt (§33)
ALTER TABLE "Belt" ADD COLUMN IF NOT EXISTS "deskripsi" TEXT;

-- 2) Tabel Setting key-value (§35: skala penilaian)
CREATE TABLE IF NOT EXISTS "Setting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- 3) Kolom periode pada StudentAssessment + unique(studentId, periode)
ALTER TABLE "StudentAssessment" ADD COLUMN IF NOT EXISTS "periode" TEXT NOT NULL DEFAULT '';

-- Backfill periode dari tanggal untuk data lama (format YYYY-MM)
UPDATE "StudentAssessment" SET "periode" = to_char("tanggal", 'YYYY-MM') WHERE "periode" = '';

-- Hapus default agar insert baru wajib mengisi periode eksplisit
ALTER TABLE "StudentAssessment" ALTER COLUMN "periode" DROP DEFAULT;

-- Unique constraint: satu penilaian per siswa per periode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentAssessment_studentId_periode_key'
  ) THEN
    ALTER TABLE "StudentAssessment"
      ADD CONSTRAINT "StudentAssessment_studentId_periode_key"
      UNIQUE ("studentId", "periode");
  END IF;
END $$;
