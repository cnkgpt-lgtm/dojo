import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin } from "@/lib/api-auth";
import { notifikasiBacaSchema } from "@/lib/validasi";

const PER_HALAMAN_MAKS = 50;

/**
 * GET /api/notifikasi — notifikasi milik user yang login (§43).
 * PATCH /api/notifikasi — tandai dibaca: { id } atau { semua: true }.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const sp = new URL(req.url).searchParams;
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "15", 10) || 15)
  );
  const hanyaBaru = sp.get("baru") === "1";

  const where = { userId: u.id, ...(hanyaBaru ? { isRead: false } : {}) };
  const [total, belumDibaca, data] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: u.id, isRead: false } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
    }),
  ]);

  return NextResponse.json({
    data,
    meta: {
      halaman,
      perHalaman,
      total,
      totalHalaman: Math.max(1, Math.ceil(total / perHalaman)),
      belumDibaca,
    },
  });
}

export async function PATCH(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const body = await req.json().catch(() => null);
  const parsed = notifikasiBacaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }
  const { id, semua } = parsed.data;

  if (semua) {
    await prisma.notification.updateMany({
      where: { userId: u.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }
  if (!id) return NextResponse.json({ error: "ID notifikasi wajib diisi." }, { status: 400 });

  const kena = await prisma.notification.updateMany({
    where: { id, userId: u.id },
    data: { isRead: true },
  });
  if (kena.count === 0)
    return NextResponse.json({ error: "Notifikasi tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
