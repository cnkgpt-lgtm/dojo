import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { beltSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/** GET /api/sabuk — daftar tingkatan sabuk (semua role yang login). */
export async function GET() {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const daftar = await prisma.belt.findMany({ orderBy: { urutan: "asc" } });
  return NextResponse.json({ data: daftar });
}

/** POST /api/sabuk — tambah tingkatan sabuk (admin, §33). */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengelola data sabuk.");

  const body = await req.json().catch(() => null);
  const parsed = beltSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  try {
    const dibuat = await prisma.belt.create({ data: parsed.data });
    await catatAudit(u.id, "TAMBAH_SABUK", "Belt", dibuat.id, { nama: dibuat.nama, urutan: dibuat.urutan });
    return NextResponse.json({ data: dibuat }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Nama atau urutan sabuk sudah dipakai. Gunakan nama dan urutan yang unik." },
        { status: 409 }
      );
    }
    throw e;
  }
}
