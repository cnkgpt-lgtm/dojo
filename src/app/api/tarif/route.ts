import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { tarifCreateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/**
 * GET /api/tarif — daftar tarif iuran (admin, §18).
 * Admin dojo hanya melihat tarif dojonya + tarif default organisasi.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengelola tarif iuran.");

  const sp = new URL(req.url).searchParams;
  const aktif = sp.get("aktif"); // "true" | "false" | ""

  const where: Prisma.FeeSettingWhereInput = {};
  if (aktif === "true") where.isActive = true;
  if (aktif === "false") where.isActive = false;
  if (u.scopeDojoId) {
    where.OR = [{ dojoId: u.scopeDojoId }, { dojoId: null }];
  }

  const data = await prisma.feeSetting.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      dojo: { select: { id: true, nama: true } },
      student: { select: { id: true, nama: true, memberId: true } },
    },
  });
  return NextResponse.json({ data });
}

/**
 * POST /api/tarif — buat tarif baru (admin, §18).
 * Cakupan: studentId (khusus siswa) ATAU dojoId (per dojo) ATAU keduanya null (default organisasi).
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat membuat tarif iuran.");

  const body = await req.json().catch(() => null);
  const parsed = tarifCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tarif tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Guard cakupan admin dojo (§5, §59.16).
  if (u.scopeDojoId) {
    if (data.dojoId && data.dojoId !== u.scopeDojoId)
      return tolak("Anda hanya dapat membuat tarif untuk dojo Anda.");
    if (data.studentId) {
      const s = await prisma.student.findUnique({
        where: { id: data.studentId },
        select: { dojoId: true, nama: true },
      });
      if (!s) return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 400 });
      if (s.dojoId !== u.scopeDojoId)
        return tolak("Anda hanya dapat membuat tarif khusus untuk siswa dojo Anda.");
    }
    if (!data.dojoId && !data.studentId)
      return tolak("Admin dojo tidak dapat membuat tarif default organisasi.");
  }

  if (data.dojoId) {
    const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
    if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  }
  if (data.studentId) {
    const s = await prisma.student.findUnique({ where: { id: data.studentId } });
    if (!s) return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 400 });
  }

  const dibuat = await prisma.feeSetting.create({ data });
  await catatAudit(u.id, "TAMBAH_TARIF", "FeeSetting", dibuat.id, {
    nama: dibuat.nama,
    nominal: dibuat.nominal,
  });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
