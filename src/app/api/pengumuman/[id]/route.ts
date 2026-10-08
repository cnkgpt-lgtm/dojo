import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { pengumumanUpdateSchema } from "@/lib/validasi";
import { wherePengumumanTerbaca } from "@/lib/pengumuman";
import { catatAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Ambil pengumuman bila boleh diakses user (tulis: admin + scope dojo). */
async function pengumumanBolehUbah(id: string, u: NonNullable<Awaited<ReturnType<typeof sesiApi>>>) {
  if (u.role !== "ADMIN") return null;
  const p = await prisma.announcement.findUnique({ where: { id } });
  if (!p) return null;
  if (u.scopeDojoId && p.dojoId !== u.scopeDojoId) return null;
  return p;
}

export async function GET(_req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await ctx.params;
  const where = await wherePengumumanTerbaca(u);
  const data = await prisma.announcement.findFirst({
    where: { ...where, id },
    include: {
      dojo: { select: { id: true, nama: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!data) return tidakKetemu("Pengumuman tidak ditemukan.");
  return NextResponse.json({ data });
}

/** PATCH /api/pengumuman/[id] — ubah pengumuman (admin only). */
export async function PATCH(req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah pengumuman.");

  const { id } = await ctx.params;
  const lama = await pengumumanBolehUbah(id, u);
  if (!lama) return tidakKetemu("Pengumuman tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = pengumumanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pengumuman tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.scopeDojoId) {
    if (data.target && data.target !== "DOJO")
      return tolak("Admin dojo hanya dapat membuat pengumuman untuk dojonya sendiri.");
    if (data.dojoId && data.dojoId !== u.scopeDojoId)
      return tolak("Anda hanya dapat mengelola pengumuman dojo Anda.");
  }

  const targetBaru = data.target ?? lama.target;
  const dojoIdBaru = data.dojoId !== undefined ? data.dojoId : lama.dojoId;
  if (targetBaru === "DOJO" && !dojoIdBaru) {
    return NextResponse.json({ error: "Target DOJO wajib memilih dojo." }, { status: 400 });
  }

  const diubah = await prisma.announcement.update({
    where: { id },
    data: {
      ...(data.judul !== undefined ? { judul: data.judul } : {}),
      ...(data.isi !== undefined ? { isi: data.isi } : {}),
      ...(data.target !== undefined ? { target: data.target } : {}),
      dojoId: targetBaru === "DOJO" ? dojoIdBaru : null,
      ...(data.tanggalMulai !== undefined ? { tanggalMulai: data.tanggalMulai } : {}),
      ...(data.tanggalSelesai !== undefined ? { tanggalSelesai: data.tanggalSelesai } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  await catatAudit(u.id, "UBAH_PENGUMUMAN", "Announcement", diubah.id, { judul: diubah.judul });
  return NextResponse.json({ data: diubah });
}

/** DELETE /api/pengumuman/[id] — hapus pengumuman (admin only). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus pengumuman.");

  const { id } = await ctx.params;
  const lama = await pengumumanBolehUbah(id, u);
  if (!lama) return tidakKetemu("Pengumuman tidak ditemukan.");

  await prisma.announcement.delete({ where: { id } });
  await catatAudit(u.id, "HAPUS_PENGUMUMAN", "Announcement", id, { judul: lama.judul });
  return NextResponse.json({ ok: true });
}
