import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { verifikasiSchema } from "@/lib/validasi";
import { labelPeriode } from "@/lib/iuran";
import { catatRevenueIuran } from "@/lib/pembayaran";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { catatAudit } from "@/lib/audit";
import { rupiah } from "@/lib/format";

/**
 * POST /api/pembayaran/[id]/verifikasi — admin APPROVE/REJECT pembayaran transfer (§22).
 * Guard atomik: hanya pembayaran MENUNGGU_VERIFIKASI yang bisa diproses
 * (updateMany where status → cegah double-approve, §49).
 * - APPROVE → payment LUNAS + invoice LUNAS + revenue tercatat (§59.10).
 * - REJECT → payment DITOLAK + invoice DITOLAK + alasan wajib (§59.9).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat memverifikasi pembayaran.");
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = verifikasiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data verifikasi tidak valid." },
      { status: 400 }
    );
  }
  const { keputusan, alasan } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      invoice: { select: { id: true, dojoId: true, periode: true, nominal: true } },
      student: { select: { id: true, nama: true, userId: true } },
    },
  });
  if (!payment) return tidakKetemu("Pembayaran tidak ditemukan.");
  if (u.scopeDojoId && payment.invoice.dojoId !== u.scopeDojoId)
    return tolak("Pembayaran ini di luar cakupan dojo Anda.");
  if (payment.metode !== "TRANSFER")
    return NextResponse.json(
      { error: "Hanya pembayaran transfer yang perlu diverifikasi." },
      { status: 400 }
    );

  if (keputusan === "APPROVE") {
    try {
      await prisma.$transaction(async (tx) => {
        // Guard atomik: tepat satu baris berubah bila masih MENUNGGU_VERIFIKASI.
        const kena = await tx.payment.updateMany({
          where: { id, status: "MENUNGGU_VERIFIKASI" },
          data: { status: "LUNAS", petugasId: u.id },
        });
        if (kena.count === 0) throw new Error("SUDAH_DIPROSES");

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: "LUNAS" },
        });
        await catatRevenueIuran(tx, {
          paymentId: id,
          dojoId: payment.invoice.dojoId,
          nominal: payment.nominal,
          metode: "TRANSFER",
          petugasId: u.id,
          deskripsi: `Iuran ${labelPeriode(payment.invoice.periode)} — ${payment.student.nama} (transfer)`,
          tanggal: payment.tanggal,
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "SUDAH_DIPROSES") {
        return NextResponse.json(
          { error: "Pembayaran ini sudah diproses sebelumnya." },
          { status: 409 }
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json(
          { error: "Pemasukan untuk pembayaran ini sudah tercatat." },
          { status: 409 }
        );
      }
      throw e;
    }

    await kirimNotifikasi(
      payment.student.userId,
      "Pembayaran diverifikasi",
      `Pembayaran iuran ${labelPeriode(payment.invoice.periode)} sebesar ${rupiah(payment.nominal)} telah diverifikasi. Status: LUNAS.`,
      "PEMBAYARAN"
    );
    await catatAudit(u.id, "VERIFIKASI_APPROVE", "Payment", id, {
      invoiceId: payment.invoiceId,
      nominal: payment.nominal,
    });
    return NextResponse.json({ ok: true, pesan: "Pembayaran disetujui. Tagihan LUNAS." });
  }

  // REJECT — alasan wajib (§59 aturan 9).
  const kena = await prisma.payment.updateMany({
    where: { id, status: "MENUNGGU_VERIFIKASI" },
    data: { status: "DITOLAK", alasanPenolakan: alasan ?? null, petugasId: u.id },
  });
  if (kena.count === 0) {
    return NextResponse.json(
      { error: "Pembayaran ini sudah diproses sebelumnya." },
      { status: 409 }
    );
  }
  await prisma.invoice.update({
    where: { id: payment.invoiceId },
    data: { status: "DITOLAK" },
  });

  await kirimNotifikasi(
    payment.student.userId,
    "Pembayaran ditolak",
    `Pembayaran ditolak. ${alasan ?? ""} Silakan periksa kembali bukti pembayaran.`,
    "PEMBAYARAN"
  );
  await catatAudit(u.id, "VERIFIKASI_REJECT", "Payment", id, {
    invoiceId: payment.invoiceId,
    alasan,
  });
  return NextResponse.json({ ok: true, pesan: "Pembayaran ditolak." });
}
