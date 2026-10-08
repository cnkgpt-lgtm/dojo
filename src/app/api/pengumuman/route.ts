import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { pengumumanCreateSchema } from "@/lib/validasi";
import { wherePengumumanTerbaca } from "@/lib/pengumuman";
import { catatAudit } from "@/lib/audit";

const PER_HALAMAN_MAKS = 50;

/**
 * GET /api/pengumuman — daftar pengumuman yang boleh dibaca user (§44).
 * Visibilitas per role diatur di lib/pengumuman.ts.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const sp = new URL(req.url).searchParams;
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "20", 10) || 20)
  );

  const where = await wherePengumumanTerbaca(u);

  const [total, data] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      include: {
        dojo: { select: { id: true, nama: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data,
    meta: { halaman, perHalaman, total, totalHalaman: Math.max(1, Math.ceil(total / perHalaman)) },
  });
}

/** POST /api/pengumuman — buat pengumuman (admin only, §44). */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat membuat pengumuman.");

  const body = await req.json().catch(() => null);
  const parsed = pengumumanCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pengumuman tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Admin dojo hanya boleh mengumumkan untuk dojonya sendiri (§5).
  let dojoId: string | null = data.dojoId ?? null;
  if (u.scopeDojoId) {
    if (data.target !== "DOJO") {
      return tolak("Admin dojo hanya dapat membuat pengumuman untuk dojonya sendiri.");
    }
    dojoId = u.scopeDojoId;
  } else if (data.target === "DOJO" && !dojoId) {
    return NextResponse.json({ error: "Target DOJO wajib memilih dojo." }, { status: 400 });
  }

  if (dojoId) {
    const dojo = await prisma.dojo.findUnique({ where: { id: dojoId } });
    if (!dojo || !dojo.isActive)
      return NextResponse.json({ error: "Dojo tidak ditemukan atau tidak aktif." }, { status: 400 });
  }

  const dibuat = await prisma.announcement.create({
    data: {
      judul: data.judul,
      isi: data.isi,
      target: data.target,
      dojoId,
      tanggalMulai: data.tanggalMulai ?? null,
      tanggalSelesai: data.tanggalSelesai ?? null,
      isActive: data.isActive,
      createdById: u.id,
    },
  });
  await catatAudit(u.id, "TAMBAH_PENGUMUMAN", "Announcement", dibuat.id, {
    judul: dibuat.judul,
    target: dibuat.target,
  });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
