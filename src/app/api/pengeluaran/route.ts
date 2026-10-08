import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { pengeluaranSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { simpanFoto } from "@/lib/upload";
import { filterTanggalKalender } from "@/lib/keuangan";

const PER_HALAMAN = 20;

/**
 * GET /api/pengeluaran — daftar pengeluaran (admin, scope dojo, §28).
 * Filter: dari, sampai (YYYY-MM-DD), kategori, metode, dojo (admin pusat), q.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat data keuangan.");

  const sp = new URL(req.url).searchParams;
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const kategori = sp.get("kategori")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const filterTanggal = filterTanggalKalender(
    sp.get("dari")?.trim() || undefined,
    sp.get("sampai")?.trim() || undefined
  );

  const where: Prisma.ExpenseWhereInput = {};
  if (u.scopeDojoId) {
    where.dojoId = u.scopeDojoId;
  } else {
    const dojoFilter = sp.get("dojo")?.trim() ?? "";
    if (dojoFilter) where.dojoId = dojoFilter;
  }
  if (kategori) where.kategoriId = kategori;
  if (Object.keys(filterTanggal).length > 0) where.tanggal = filterTanggal;
  if (q) where.deskripsi = { contains: q, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
      skip: (halaman - 1) * PER_HALAMAN,
      take: PER_HALAMAN,
      include: {
        kategori: { select: { nama: true } },
        dojo: { select: { id: true, nama: true } },
        petugas: { select: { name: true } },
      },
    }),
    prisma.expense.count({ where }),
  ]);
  return NextResponse.json({
    data,
    halaman,
    totalHalaman: Math.max(1, Math.ceil(total / PER_HALAMAN)),
    total,
  });
}

/** POST /api/pengeluaran — catat pengeluaran (admin, §28). Audit §45. */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mencatat pengeluaran.");

  const contentType = req.headers.get("content-type") ?? "";
  let nilai: Record<string, unknown>;
  let buktiFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    nilai = {
      tanggal: form.get("tanggal"),
      kategoriId: form.get("kategoriId"),
      deskripsi: form.get("deskripsi"),
      nominal: form.get("nominal"),
      dojoId: form.get("dojoId"),
      catatan: form.get("catatan"),
    };
    const f = form.get("bukti");
    if (f instanceof File && f.size > 0) buktiFile = f;
  } else {
    nilai = (await req.json().catch(() => null)) ?? {};
  }

  const parsed = pengeluaranSchema.safeParse(nilai);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pengeluaran tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.scopeDojoId && data.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mencatat pengeluaran untuk dojo Anda.");

  const [dojo, kategori] = await Promise.all([
    prisma.dojo.findUnique({ where: { id: data.dojoId } }),
    prisma.expenseCategory.findUnique({ where: { id: data.kategoriId } }),
  ]);
  if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  if (!kategori || !kategori.isActive)
    return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });

  let buktiUrl: string | null = null;
  if (buktiFile) {
    const simpan = await simpanFoto(buktiFile, "bukti");
    if (!simpan.ok) return NextResponse.json({ error: simpan.error }, { status: 400 });
    buktiUrl = simpan.url;
  }

  const dibuat = await prisma.expense.create({
    data: {
      dojoId: data.dojoId,
      tanggal: data.tanggal,
      kategoriId: data.kategoriId,
      deskripsi: data.deskripsi,
      nominal: data.nominal,
      petugasId: u.id,
      buktiUrl,
      catatan: data.catatan || null,
    },
  });
  await catatAudit(u.id, "TAMBAH_PENGELUARAN", "Expense", dibuat.id, {
    deskripsi: dibuat.deskripsi,
    nominal: dibuat.nominal,
  });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
