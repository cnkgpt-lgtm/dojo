import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { tunaiSchema } from "@/lib/validasi";
import { sisaTagihan, labelPeriode } from "@/lib/iuran";
import { catatRevenueIuran } from "@/lib/pembayaran";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { catatAudit } from "@/lib/audit";
import { rupiah } from "@/lib/format";

/**
 * POST /api/pembayaran/tunai — catat pembayaran tunai oleh admin (§21).
 * Status langsung LUNAS; nominal harus pas dengan sisa tagihan.
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mencatat pembayaran tunai.");

  const body = await req.json().catch(() => null);
  const parsed = tunaiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid." },
      { status: 400 }
    );
  }
  const { invoiceId, nominal, tanggal, catatan } = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { id: true, nama: true, userId: true } } },
  });
  if (!invoice) return tidakKetemu("Tagihan tidak ditemukan.");
  if (u.scopeDojoId && invoice.dojoId !== u.scopeDojoId)
    return tolak("Tagihan ini di luar cakupan dojo Anda.");
  if (invoice.status === "LUNAS")
    return NextResponse.json({ error: "Tagihan sudah lunas." }, { status: 409 });
  if (invoice.status === "MENUNGGU_VERIFIKASI")
    return NextResponse.json(
      { error: "Tagihan sedang menunggu verifikasi transfer. Batalkan dulu bila ingin mencatat tunai." },
      { status: 409 }
    );
  if (invoice.status === "DIBATALKAN")
    return NextResponse.json({ error: "Tagihan sudah dibatalkan." }, { status: 409 });

  const sisa = await sisaTagihan(invoiceId);
  if (!sisa) return tidakKetemu("Tagihan tidak ditemukan.");
  if (nominal !== sisa.sisa) {
    return NextResponse.json(
      { error: `Nominal harus pas ${rupiah(sisa.sisa)} (sisa tagihan).` },
      { status: 400 }
    );
  }

  const tglBayar = tanggal ?? new Date();

  try {
    const payment = await prisma.$transaction(async (tx) => {
      // Kunci baris invoice + baca ulang status: cegah balapan dua pencatatan
      // tunai bersamaan (§60). Berlaku walau partial unique index belum diterapkan.
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const segar = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      });
      if (segar?.status === "LUNAS" || segar?.status === "MENUNGGU_VERIFIKASI") {
        throw new Error("SUDAH_DIPROSES");
      }
      const p = await tx.payment.create({
        data: {
          invoiceId,
          studentId: invoice.studentId,
          nominal,
          metode: "TUNAI",
          tanggal: tglBayar,
          status: "LUNAS",
          petugasId: u.id,
          catatan: catatan ?? null,
        },
      });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "LUNAS" } });
      await catatRevenueIuran(tx, {
        paymentId: p.id,
        dojoId: invoice.dojoId,
        nominal,
        metode: "TUNAI",
        petugasId: u.id,
        deskripsi: `Iuran ${labelPeriode(invoice.periode)} — ${invoice.student.nama} (tunai)`,
        tanggal: tglBayar,
      });
      return p;
    });

    await kirimNotifikasi(
      invoice.student.userId,
      "Pembayaran diterima",
      `Pembayaran iuran ${labelPeriode(invoice.periode)} sebesar ${rupiah(nominal)} telah diterima. Terima kasih.`,
      "PEMBAYARAN"
    );
    await catatAudit(u.id, "PEMBAYARAN_TUNAI", "Payment", payment.id, {
      invoiceId,
      nominal,
      siswa: invoice.student.nama,
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "SUDAH_DIPROSES") {
      return NextResponse.json(
        { error: "Tagihan ini sudah diproses (lunas/menunggu verifikasi)." },
        { status: 409 }
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Tagihan ini sudah memiliki pembayaran yang diproses." },
        { status: 409 }
      );
    }
    throw e;
  }
}
