import { NextResponse } from "next/server";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { ringkasanAdmin } from "@/lib/dashboard";

/**
 * GET /api/dashboard/admin — ringkasan angka dashboard admin (§37).
 * Agregasi efisien dalam satu panggilan, mengikuti scope dojo admin.
 */
export async function GET() {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengakses ringkasan ini.");
  const data = await ringkasanAdmin(u.scopeDojoId);
  return NextResponse.json({ data });
}
