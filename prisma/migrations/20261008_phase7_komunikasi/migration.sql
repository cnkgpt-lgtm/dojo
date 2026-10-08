-- Phase 7: Pengumuman + idempotensi pengingat iuran (§44, §67).
-- JALANKAN SEKALI via psql (deploy memakai `prisma db push`, jadi file ini
-- adalah hardening manual, sama seperti migrasi Phase 4 & 6). Aman dijalankan ulang.

-- 1) Kolom baru di Announcement.
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "target" TEXT NOT NULL DEFAULT 'SEMUA';
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "tanggalMulai" TIMESTAMPTZ;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "tanggalSelesai" TIMESTAMPTZ;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "Announcement_isActive_target_idx"
  ON "Announcement" ("isActive", "target");

-- 2) Kolom refId di Notification + unique untuk idempotensi (§67).
--    Di Postgres, NULL tidak dianggap sama dalam unique constraint,
--    sehingga notifikasi operasional (refId NULL) tetap boleh ganda.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "refId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Notification_userId_tipe_refId_key'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_userId_tipe_refId_key"
      UNIQUE ("userId", "tipe", "refId");
  END IF;
END $$;
