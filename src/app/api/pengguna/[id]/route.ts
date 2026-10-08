import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { catatAudit } from "@/lib/audit";
import { z } from "zod";
import bcrypt from "bcryptjs";

const penggunaUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6, "Kata sandi minimal 6 karakter").max(100).optional(),
});

/**
 * PATCH /api/pengguna/[id] — nonaktifkan/aktifkan akun atau reset kata sandi (admin only).
 * Tidak bisa menonaktifkan akun sendiri.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah pengguna.");

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return tidakKetemu("Pengguna tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = penggunaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.isActive === false && id === u.id) {
    return NextResponse.json({ error: "Tidak bisa menonaktifkan akun sendiri." }, { status: 400 });
  }

  const updateData: { isActive?: boolean; passwordHash?: string; sessionVersion?: { increment: number } } = {};
  if (typeof data.isActive === "boolean") {
    updateData.isActive = data.isActive;
    // Naikkan sessionVersion agar sesi lama langsung mati bila dinonaktifkan.
    if (!data.isActive) updateData.sessionVersion = { increment: 1 };
  }
  if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 10);

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data: updateData });
  await catatAudit(u.id, "UBAH_PENGGUNA", "User", id, {
    isActive: data.isActive,
    resetPassword: !!data.password,
  });
  return NextResponse.json({ pesan: "Pengguna berhasil diperbarui." });
}
