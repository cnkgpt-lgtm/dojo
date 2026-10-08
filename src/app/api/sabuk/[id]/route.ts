import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { beltUpdateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/** GET /api/sabuk/[id] — detail tingkatan sabuk. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const { id } = await params;
  const data = await prisma.belt.findUnique({ where: { id } });
  if (!data) return tidakKetemu("Data sabuk tidak ditemukan.");
  return NextResponse.json({ data });
}

/** PATCH /api/sabuk/[id] — ubah tingkatan sabuk (admin, §33). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengelola data sabuk.");

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = beltUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  try {
    const diubah = await prisma.belt.update({ where: { id }, data: parsed.data });
    await catatAudit(u.id, "UBAH_SABUK", "Belt", id, { nama: diubah.nama });
    return NextResponse.json({ data: diubah });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Nama atau urutan sabuk sudah dipakai." }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return tidakKetemu("Data sabuk tidak ditemukan.");
    }
    throw e;
  }
}

/** DELETE /api/sabuk/[id] — hapus tingkatan sabuk (admin). Ditolak bila masih dipakai. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengelola data sabuk.");

  const { id } = await params;
  const dipakai = await prisma.belt.findUnique({
    where: { id },
    include: {
      _count: { select: { currentStudents: true, historyFrom: true, historyTo: true } },
    },
  });
  if (!dipakai) return tidakKetemu("Data sabuk tidak ditemukan.");
  const total =
    dipakai._count.currentStudents + dipakai._count.historyFrom + dipakai._count.historyTo;
  if (total > 0) {
    return NextResponse.json(
      { error: "Sabuk tidak dapat dihapus karena masih dipakai data siswa atau riwayat." },
      { status: 409 }
    );
  }

  await prisma.belt.delete({ where: { id } });
  await catatAudit(u.id, "HAPUS_SABUK", "Belt", id, { nama: dipakai.nama });
  return NextResponse.json({ ok: true });
}
