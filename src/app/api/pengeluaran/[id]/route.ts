import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { pengeluaranUpdateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { simpanFoto, hapusFotoLama } from "@/lib/upload";

async function ambil(id: string, scopeDojoId: string | null) {
  const e = await prisma.expense.findUnique({
    where: { id },
    include: {
      kategori: { select: { nama: true } },
      dojo: { select: { id: true, nama: true } },
      petugas: { select: { name: true } },
    },
  });
  if (!e) return null;
  if (scopeDojoId && e.dojoId !== scopeDojoId) return null;
  return e;
}

/** GET /api/pengeluaran/[id] — detail (admin, scope dojo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat data keuangan.");
  const { id } = await params;
  const data = await ambil(id, u.scopeDojoId);
  if (!data) return tidakKetemu("Data pengeluaran tidak ditemukan.");
  return NextResponse.json({ data });
}

/** PATCH /api/pengeluaran/[id] — ubah (admin, §45 audit). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah data keuangan.");
  const { id } = await params;

  const lama = await ambil(id, u.scopeDojoId);
  if (!lama) return tidakKetemu("Data pengeluaran tidak ditemukan.");

  const contentType = req.headers.get("content-type") ?? "";
  let nilai: Record<string, unknown>;
  let buktiFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    nilai = {};
    for (const k of ["tanggal", "kategoriId", "deskripsi", "nominal", "dojoId", "catatan"]) {
      const v = form.get(k);
      if (v !== null && v !== "") nilai[k] = v;
    }
    const f = form.get("bukti");
    if (f instanceof File && f.size > 0) buktiFile = f;
  } else {
    nilai = (await req.json().catch(() => null)) ?? {};
  }

  const parsed = pengeluaranUpdateSchema.safeParse(nilai);
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
    const kat = await prisma.expenseCategory.findUnique({ where: { id: data.kategoriId } });
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

  const diubah = await prisma.expense.update({
    where: { id },
    data: { ...data, buktiUrl },
  });
  await catatAudit(u.id, "UBAH_PENGELUARAN", "Expense", id, { nominal: diubah.nominal });
  return NextResponse.json({ data: diubah });
}

/** DELETE /api/pengeluaran/[id] — hapus (admin, tercatat di audit §59.17–18). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus data keuangan.");
  const { id } = await params;

  const lama = await ambil(id, u.scopeDojoId);
  if (!lama) return tidakKetemu("Data pengeluaran tidak ditemukan.");

  await prisma.expense.delete({ where: { id } });
  await hapusFotoLama(lama.buktiUrl);
  await catatAudit(u.id, "HAPUS_PENGELUARAN", "Expense", id, {
    deskripsi: lama.deskripsi,
    nominal: lama.nominal,
  });
  return NextResponse.json({ ok: true });
}
