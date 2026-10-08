import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { pemasukanSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { simpanFoto } from "@/lib/upload";
import { filterTanggalKalender } from "@/lib/keuangan";

const PER_HALAMAN = 20;

/**
 * GET /api/pemasukan — daftar pemasukan (admin, scope dojo, §27).
 * Filter: dari, sampai (YYYY-MM-DD), kategori, metode, dojo (admin pusat), q (deskripsi).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat data keuangan.");

  const sp = new URL(req.url).searchParams;
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const kategori = sp.get("kategori")?.trim() ?? "";
  const metode = sp.get("metode")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const filterTanggal = filterTanggalKalender(
    sp.get("dari")?.trim() || undefined,
    sp.get("sampai")?.trim() || undefined
  );

  const where: Prisma.RevenueWhereInput = {};
  if (u.scopeDojoId) {
    where.dojoId = u.scopeDojoId;
  } else {
    const dojoFilter = sp.get("dojo")?.trim() ?? "";
    if (dojoFilter) where.dojoId = dojoFilter;
  }
  if (kategori) where.kategoriId = kategori;
  if (metode === "TUNAI" || metode === "TRANSFER") where.metode = metode;
  if (Object.keys(filterTanggal).length > 0) where.tanggal = filterTanggal;
  if (q) where.deskripsi = { contains: q, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.revenue.findMany({
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
    prisma.revenue.count({ where }),
  ]);
  return NextResponse.json({
    data,
    halaman,
    totalHalaman: Math.max(1, Math.ceil(total / PER_HALAMAN)),
    total,
  });
}

/**
 * POST /api/pemasukan — catat pemasukan manual (admin, §27).
 * Terima multipart (bukti opsional) atau JSON. Pemasukan otomatis dari
 * pembayaran iuran Phase 4 TIDAK dibuat lewat sini (punya paymentId).
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mencatat pemasukan.");

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
      metode: form.get("metode"),
      dojoId: form.get("dojoId"),
    };
    const f = form.get("bukti");
    if (f instanceof File && f.size > 0) buktiFile = f;
  } else {
    nilai = (await req.json().catch(() => null)) ?? {};
  }

  const parsed = pemasukanSchema.safeParse(nilai);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pemasukan tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.scopeDojoId && data.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mencatat pemasukan untuk dojo Anda.");

  const [dojo, kategori] = await Promise.all([
    prisma.dojo.findUnique({ where: { id: data.dojoId } }),
    prisma.revenueCategory.findUnique({ where: { id: data.kategoriId } }),
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

  const dibuat = await prisma.revenue.create({
    data: {
      dojoId: data.dojoId,
      tanggal: data.tanggal,
      kategoriId: data.kategoriId,
      deskripsi: data.deskripsi,
      nominal: data.nominal,
      metode: data.metode,
      petugasId: u.id,
      buktiUrl,
    },
  });
  await catatAudit(u.id, "TAMBAH_PEMASUKAN", "Revenue", dibuat.id, {
    deskripsi: dibuat.deskripsi,
    nominal: dibuat.nominal,
  });
  return NextResponse.json({ data: dibuat }, { status: 201 });
}
