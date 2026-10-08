import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { siswaUpdateSchema } from "@/lib/validasi";
import { hapusFotoLama } from "@/lib/upload";
import { catatAudit } from "@/lib/audit";
import type { SesiPengguna } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

const includeDetail = {
  dojo: { select: { id: true, nama: true } },
  sabuk: { select: { id: true, nama: true } },
} as const;

/** Siswa yang boleh diakses sesi ini, atau null. */
async function siswaTerjangkau(u: SesiPengguna, id: string) {
  const s = await prisma.student.findUnique({ where: { id }, include: includeDetail });
  if (!s) return null;
  if (u.role === "ADMIN") {
    if (u.scopeDojoId && s.dojoId !== u.scopeDojoId) return null;
    return s;
  }
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!ids.includes(s.dojoId)) return null;
    return s;
  }
  // SISWA: hanya miliknya sendiri (§59.14)
  if (u.studentId !== s.id) return null;
  return s;
}

export async function GET(_req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await params;
  const s = await siswaTerjangkau(u, id);
  if (!s) return tidakKetemu("Data siswa tidak ditemukan.");
  return NextResponse.json({ data: s });
}

export async function PATCH(req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah data siswa.");
  const { id } = await params;

  const lama = await prisma.student.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Data siswa tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mengubah siswa di dojo Anda.");

  const body = await req.json().catch(() => null);
  const parsed = siswaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data siswa tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.dojoId) {
    if (u.scopeDojoId && data.dojoId !== u.scopeDojoId)
      return tolak("Anda hanya dapat memindahkan siswa di dalam dojo Anda.");
    const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
    if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  }
  if (data.sabukId) {
    const sabuk = await prisma.belt.findUnique({ where: { id: data.sabukId } });
    if (!sabuk) return NextResponse.json({ error: "Sabuk tidak ditemukan." }, { status: 400 });
  }

  const diubah = await prisma.student.update({ where: { id }, data, include: includeDetail });
  if (data.foto && lama.foto && data.foto !== lama.foto) await hapusFotoLama(lama.foto);
  await catatAudit(u.id, "UBAH_SISWA", "Student", id, { nama: diubah.nama, memberId: diubah.memberId });
  return NextResponse.json({ data: diubah });
}

export async function DELETE(_req: Request, { params }: Params) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus data siswa.");
  const { id } = await params;

  const lama = await prisma.student.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Data siswa tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat menghapus siswa di dojo Anda.");

  try {
    await prisma.student.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Siswa masih memiliki data terkait yang dilindungi. Ubah statusnya menjadi Keluar." },
        { status: 409 }
      );
    }
    throw e;
  }
  await hapusFotoLama(lama.foto);
  // §59.17: penghapusan data penting tercatat di audit log
  await catatAudit(u.id, "HAPUS_SISWA", "Student", id, { nama: lama.nama, memberId: lama.memberId });
  return NextResponse.json({ ok: true });
}
