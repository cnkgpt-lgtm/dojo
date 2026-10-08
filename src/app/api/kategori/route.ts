import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { kategoriSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

/**
 * GET /api/kategori — daftar kategori keuangan (§27, §28).
 * ?tipe=pemasukan|pengeluaran — tanpa tipe: kembalikan keduanya.
 * Kategori bawaan sudah di-seed (idempoten, upsert).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat kategori keuangan.");

  const tipe = new URL(req.url).searchParams.get("tipe");
  const [pemasukan, pengeluaran] = await Promise.all([
    tipe === "pengeluaran"
      ? []
      : prisma.revenueCategory.findMany({
          where: { isActive: true },
          orderBy: { nama: "asc" },
        }),
    tipe === "pemasukan"
      ? []
      : prisma.expenseCategory.findMany({
          where: { isActive: true },
          orderBy: { nama: "asc" },
        }),
  ]);
  return NextResponse.json({ data: { pemasukan, pengeluaran } });
}

/** POST /api/kategori — tambah kategori (admin). */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menambah kategori.");

  const body = await req.json().catch(() => null);
  const parsed = kategoriSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data kategori tidak valid." },
      { status: 400 }
    );
  }
  const { tipe, nama } = parsed.data;

  try {
    const data =
      tipe === "pemasukan"
        ? await prisma.revenueCategory.create({ data: { nama } })
        : await prisma.expenseCategory.create({ data: { nama } });
    await catatAudit(u.id, "TAMBAH_KATEGORI", tipe === "pemasukan" ? "RevenueCategory" : "ExpenseCategory", data.id, { nama });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Kategori dengan nama itu sudah ada." }, { status: 409 });
    }
    throw e;
  }
}
