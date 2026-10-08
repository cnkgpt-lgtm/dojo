import { NextResponse } from "next/server";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { telegramStorageConfigured } from "@/lib/telegram-storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/storage/status — backend penyimpanan file yang sedang aktif.
 * Hanya boolean (tidak membocorkan secret). Untuk ADMIN & SENSEI
 * (badge di halaman verifikasi pembayaran & monitor absensi).
 */
export async function GET() {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN" && u.role !== "SENSEI") return tolak("Akses ditolak.");

  const telegram = telegramStorageConfigured();
  return NextResponse.json({
    telegram,
    aktif: telegram ? "TELEGRAM" : "DATABASE",
  });
}
