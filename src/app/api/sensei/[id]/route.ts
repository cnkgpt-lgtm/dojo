import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { senseiUpdateSchema } from "@/lib/validasi";
import { hapusFotoLama } from "@/lib/upload";
import { catatAudit } from "@/lib/audit";
import type { SesiPengguna } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

const includeDetail = {
  dojo: { select: { id: true, nama: true } },
  schedules: { select: { id: true, namaLatihan: true, hari: true, jamMulai: true, jamSelesai: true } },
} as const;

async function senseiTerjangkau(u: SesiPengguna, id: string) {
  const c = await prisma.coach.findUnique({ where: { id }, include: includeDetail });
  if (!c) return null;
  if (u.role === "ADMIN") {
    if (u.scopeDojoId && c.dojoId !== u.scopeDojoId) return null;
    return c;
  }
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!c.dojoId || !ids.includes(c.dojoId)) return null;
    return c;
  }
  return null; // SISWA tidak boleh
}

export async function GET(_req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role === "SISWA") return tolak("Akun siswa hanya dapat melihat profil sendiri.");
  const { id } = await params;
  const c = await senseiTerjangkau(u, id);
  if (!c) return tidakKetemu("Data sensei tidak ditemukan.");
  return NextResponse.json({ data: c });
}

export async function PATCH(req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah data sensei.");
  const { id } = await params;

  const lama = await prisma.coach.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Data sensei tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mengubah sensei di dojo Anda.");

  const body = await req.json().catch(() => null);
  const parsed = senseiUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data sensei tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.dojoId) {
    if (u.scopeDojoId && data.dojoId !== u.scopeDojoId)
      return tolak("Anda hanya dapat menempatkan sensei di dojo Anda.");
    const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
    if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  }

  const diubah = await prisma.coach.update({ where: { id }, data, include: includeDetail });
  if (data.foto && lama.foto && data.foto !== lama.foto) await hapusFotoLama(lama.foto);
  await catatAudit(u.id, "UBAH_SENSEI", "Coach", id, { nama: diubah.nama });
  return NextResponse.json({ data: diubah });
}

export async function DELETE(_req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus data sensei.");
  const { id } = await params;

  const lama = await prisma.coach.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Data sensei tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat menghapus sensei di dojo Anda.");

  try {
    await prisma.coach.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Sensei masih memiliki data terkait (penilaian). Nonaktifkan saja." },
        { status: 409 }
      );
    }
    throw e;
  }
  await hapusFotoLama(lama.foto);
  await catatAudit(u.id, "HAPUS_SENSEI", "Coach", id, { nama: lama.nama });
  return NextResponse.json({ ok: true });
}
