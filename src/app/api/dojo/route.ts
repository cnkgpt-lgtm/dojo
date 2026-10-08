import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { dojoSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/** GET /api/dojo — daftar dojo untuk dropdown & admin (scope sesuai role, §5). */
export async function GET() {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat daftar dojo.");

  const dojo = await prisma.dojo.findMany({
    where: u.scopeDojoId ? { id: u.scopeDojoId } : {},
    orderBy: { nama: "asc" },
    include: { _count: { select: { students: true, coaches: true } } },
  });
  return NextResponse.json({ data: dojo });
}

/** POST /api/dojo — tambah dojo (admin pusat saja). */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menambah dojo.");
  if (u.scopeDojoId) return tolak("Hanya admin pusat yang dapat menambah dojo.");

  const body = await req.json().catch(() => null);
  const parsed = dojoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data dojo tidak valid." },
      { status: 400 }
    );
  }

  const kodeDipakai = await prisma.dojo.findUnique({ where: { kode: parsed.data.kode } });
  if (kodeDipakai) return NextResponse.json({ error: "Kode dojo sudah dipakai." }, { status: 409 });

  const org = await prisma.organization.findFirst();
  if (!org) return NextResponse.json({ error: "Data organisasi belum ada." }, { status: 500 });

  const dibuat = await prisma.dojo.create({
    data: { ...parsed.data, organizationId: org.id },
  });
  await catatAudit(u.id, "TAMBAH_DOJO", "Dojo", dibuat.id, { nama: dibuat.nama, kode: dibuat.kode });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
