import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { pemasukanUpdateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { simpanFoto, hapusFotoLama } from "@/lib/upload";

async function ambil(id: string, scopeDojoId: string | null) {
  const r = await prisma.revenue.findUnique({
    where: { id },
    include: {
      kategori: { select: { nama: true } },
      dojo: { select: { id: true, nama: true } },
      petugas: { select: { name: true } },
    },
  });
  if (!r) return null;
  if (scopeDojoId && r.dojoId !== scopeDojoId) return null;
  return r;
}

/** GET /api/pemasukan/[id] — detail (admin, scope dojo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat data keuangan.");
  const { id } = await params;
  const data = await ambil(id, u.scopeDojoId);
  if (!data) return tidakKetemu("Data pemasukan tidak ditemukan.");
  return NextResponse.json({ data });
}

/**
 * PATCH /api/pemasukan/[id] — ubah (admin).
 * DITOLAK (409) bila entri otomatis dari pembayaran iuran (paymentId terisi, §49):
 * mengubahnya akan merusak konsistensi dengan pembayaran Phase 4.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah data keuangan.");
  const { id } = await params;

  const lama = await ambil(id, u.scopeDojoId);
  if (!lama) return tidakKetemu("Data pemasukan tidak ditemukan.");
  if (lama.paymentId) {
    return NextResponse.json(
      { error: "Pemasukan otomatis dari pembayaran iuran tidak dapat diubah. Koreksi lewat modul pembayaran." },
      { status: 409 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  let nilai: Record<string, unknown>;
  let buktiFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    nilai = {};
    for (const k of ["tanggal", "kategoriId", "deskripsi", "nominal", "metode", "dojoId"]) {
      const v = form.get(k);
      if (v !== null && v !== "") nilai[k] = v;
    }
    const f = form.get("bukti");
    if (f instanceof File && f.size > 0) buktiFile = f;
  } else {
    nilai = (await req.json().catch(() => null)) ?? {};
  }

  const parsed = pemasukanUpdateSchema.safeParse(nilai);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.dojoId && u.scopeDojoId && data.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mengelola keuangan dojo Anda.");
  if (data.kategoriId) {
    const kat = await prisma.revenueCategory.findUnique({ where: { id: data.kategoriId } });
    if (!kat || !kat.isActive)
      return NextResponse.json({ error: "Kategori tidak valid." }, { status: 400 });
  }

  let buktiUrl = lama.buktiUrl;
  if (buktiFile) {
    const simpan = await simpanFoto(buktiFile, "bukti");
    if (!simpan.ok) return NextResponse.json({ error: simpan.error }, { status: 400 });
    buktiUrl = simpan.url;
    await hapusFotoLama(lama.buktiUrl);
  }

  const diubah = await prisma.revenue.update({
    where: { id },
    data: { ...data, buktiUrl },
  });
  await catatAudit(u.id, "UBAH_PEMASUKAN", "Revenue", id, { nominal: diubah.nominal });
  return NextResponse.json({ data: diubah });
}

/**
 * DELETE /api/pemasukan/[id] — hapus (admin).
 * DITOLAK (409) bila entri otomatis dari pembayaran iuran (paymentId terisi):
 * transaksi keuangan tidak boleh hilang tanpa jejak (§59.18).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus data keuangan.");
  const { id } = await params;

  const lama = await ambil(id, u.scopeDojoId);
  if (!lama) return tidakKetemu("Data pemasukan tidak ditemukan.");
  if (lama.paymentId) {
    return NextResponse.json(
      { error: "Pemasukan otomatis dari pembayaran iuran tidak dapat dihapus." },
      { status: 409 }
    );
  }

  await prisma.revenue.delete({ where: { id } });
  await hapusFotoLama(lama.buktiUrl);
  await catatAudit(u.id, "HAPUS_PEMASUKAN", "Revenue", id, {
    deskripsi: lama.deskripsi,
    nominal: lama.nominal,
  });
  return NextResponse.json({ ok: true });
}
