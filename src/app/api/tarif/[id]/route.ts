import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { tarifUpdateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/** Tarif terlihat oleh admin bila: default organisasi, dojonya, atau admin pusat. */
async function tarifTerjangkau(
  id: string,
  scopeDojoId: string | null
): Promise<{ ok: boolean; dojoId: string | null; studentDojoId?: string | null }> {
  const t = await prisma.feeSetting.findUnique({
    where: { id },
    select: {
      dojoId: true,
      student: { select: { dojoId: true } },
    },
  });
  if (!t) return { ok: false, dojoId: null };
  if (!scopeDojoId) return { ok: true, dojoId: t.dojoId };
  const studentDojoId = t.student?.dojoId ?? null;
  const ok =
    t.dojoId === scopeDojoId || studentDojoId === scopeDojoId || (t.dojoId === null && !t.student);
  return { ok, dojoId: t.dojoId, studentDojoId };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengelola tarif iuran.");
  const { id } = await ctx.params;

  const t = await prisma.feeSetting.findUnique({
    where: { id },
    include: {
      dojo: { select: { id: true, nama: true } },
      student: { select: { id: true, nama: true, memberId: true } },
    },
  });
  if (!t) return tidakKetemu("Tarif tidak ditemukan.");
  const akses = await tarifTerjangkau(id, u.scopeDojoId);
  if (!akses.ok) return tolak("Tarif ini di luar cakupan dojo Anda.");
  return NextResponse.json({ data: t });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah tarif iuran.");
  const { id } = await ctx.params;

  const akses = await tarifTerjangkau(id, u.scopeDojoId);
  if (!akses.ok) return tolak("Tarif ini di luar cakupan dojo Anda.");

  const body = await req.json().catch(() => null);
  const parsed = tarifUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tarif tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Admin dojo tidak boleh mengubah tarif default organisasi menjadi miliknya/dijangkau.
  if (u.scopeDojoId && akses.dojoId === null && !akses.studentDojoId) {
    if (data.isActive === false || data.nominal !== undefined || data.hariJatuhTempo !== undefined)
      return tolak("Admin dojo tidak dapat mengubah tarif default organisasi.");
  }

  const diubah = await prisma.feeSetting.update({ where: { id }, data });
  await catatAudit(u.id, "UBAH_TARIF", "FeeSetting", id, {
    nama: diubah.nama,
    nominal: diubah.nominal,
  });
  return NextResponse.json({ data: diubah });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus tarif iuran.");
  const { id } = await ctx.params;

  const akses = await tarifTerjangkau(id, u.scopeDojoId);
  if (!akses.ok) return tolak("Tarif ini di luar cakupan dojo Anda.");
  if (u.scopeDojoId && akses.dojoId === null && !akses.studentDojoId)
    return tolak("Admin dojo tidak dapat menghapus tarif default organisasi.");

  const dipakai = await prisma.invoice.count({ where: { feeSettingId: id } });
  if (dipakai > 0)
    return NextResponse.json(
      { error: `Tarif sudah dipakai ${dipakai} tagihan dan tidak dapat dihapus. Nonaktifkan saja.` },
      { status: 409 }
    );

  await prisma.feeSetting.delete({ where: { id } });
  await catatAudit(u.id, "HAPUS_TARIF", "FeeSetting", id, {});
  return NextResponse.json({ ok: true });
}
