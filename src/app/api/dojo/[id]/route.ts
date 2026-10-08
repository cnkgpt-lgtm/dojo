import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { dojoUpdateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import type { SesiPengguna } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

/** Dojo yang boleh diakses admin ini (admin dojo: hanya dojonya, §5). */
async function dojoTerjangkau(u: SesiPengguna, id: string) {
  const d = await prisma.dojo.findUnique({ where: { id } });
  if (!d) return null;
  if (u.scopeDojoId && d.id !== u.scopeDojoId) return null;
  return d;
}

export async function GET(_req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat data dojo.");
  const { id } = await params;
  const d = await prisma.dojo.findUnique({
    where: { id },
    include: { _count: { select: { students: true, coaches: true, schedules: true } } },
  });
  if (!d || (u.scopeDojoId && d.id !== u.scopeDojoId)) return tidakKetemu("Dojo tidak ditemukan.");
  return NextResponse.json({ data: d });
}

export async function PATCH(req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah dojo.");
  const { id } = await params;
  const d = await dojoTerjangkau(u, id);
  if (!d) return tidakKetemu("Dojo tidak ditemukan.");

  const body = await req.json().catch(() => null);
  const parsed = dojoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data dojo tidak valid." },
      { status: 400 }
    );
  }
  if (parsed.data.kode && parsed.data.kode !== d.kode) {
    const dipakai = await prisma.dojo.findUnique({ where: { kode: parsed.data.kode } });
    if (dipakai) return NextResponse.json({ error: "Kode dojo sudah dipakai." }, { status: 409 });
  }

  const diubah = await prisma.dojo.update({ where: { id }, data: parsed.data });
  await catatAudit(u.id, "UBAH_DOJO", "Dojo", id, { nama: diubah.nama });
  return NextResponse.json({ data: diubah });
}

export async function DELETE(_req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN" || u.scopeDojoId)
    return tolak("Hanya admin pusat yang dapat menghapus dojo.");
  const { id } = await params;
  const d = await prisma.dojo.findUnique({ where: { id } });
  if (!d) return tidakKetemu("Dojo tidak ditemukan.");

  try {
    await prisma.dojo.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Dojo masih memiliki data terkait (siswa, jadwal, atau keuangan). Nonaktifkan saja." },
        { status: 409 }
      );
    }
    throw e;
  }
  await catatAudit(u.id, "HAPUS_DOJO", "Dojo", id, { nama: d.nama, kode: d.kode });
  return NextResponse.json({ ok: true });
}
