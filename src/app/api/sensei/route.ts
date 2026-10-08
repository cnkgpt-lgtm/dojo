import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, dojoIdsUntukSensei } from "@/lib/api-auth";
import { senseiCreateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/**
 * GET /api/sensei — daftar sensei.
 * Admin: semua dalam scope. Sensei: sensei di dojo tanggung jawabnya.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role === "SISWA") return tolak("Akun siswa hanya dapat melihat profil sendiri.");

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const where: Prisma.CoachWhereInput = {};
  if (q) where.nama = { contains: q, mode: "insensitive" };

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) where.dojoId = u.scopeDojoId;
    else if (sp.get("dojo")) where.dojoId = sp.get("dojo")!;
  } else {
    const ids = await dojoIdsUntukSensei(u.coachId);
    where.dojoId = { in: ids.length > 0 ? ids : ["__kosong__"] };
  }

  const data = await prisma.coach.findMany({
    where,
    orderBy: { nama: "asc" },
    include: { dojo: { select: { id: true, nama: true } } },
  });
  return NextResponse.json({ data });
}

/** POST /api/sensei — tambah sensei (admin only), field §11. */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menambah sensei.");

  const body = await req.json().catch(() => null);
  const parsed = senseiCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data sensei tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.scopeDojoId && data.dojoId && data.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat menambah sensei di dojo Anda.");
  const dojoId = data.dojoId ?? u.scopeDojoId ?? null;
  if (dojoId) {
    const dojo = await prisma.dojo.findUnique({ where: { id: dojoId } });
    if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  }

  const dibuat = await prisma.coach.create({ data: { ...data, dojoId } });
  await catatAudit(u.id, "TAMBAH_SENSEI", "Coach", dibuat.id, { nama: dibuat.nama });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
