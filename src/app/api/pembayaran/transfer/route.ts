import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu } from "@/lib/api-auth";
import { transferSchema } from "@/lib/validasi";
import { simpanFile, hapusFile } from "@/lib/upload";
import { sisaTagihan, labelPeriode } from "@/lib/iuran";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { catatAudit } from "@/lib/audit";
import { rupiah } from "@/lib/format";

/**
 * POST /api/pembayaran/transfer — siswa upload bukti transfer (§22, §54).
 * Status menjadi MENUNGGU_VERIFIKASI. Anti-duplikat: satu invoice hanya boleh
 * punya satu pembayaran aktif (partial unique index + P2002 → 409, §60).
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "SISWA") return tolak("Hanya siswa yang dapat mengirim pembayaran transfer.");
  if (!u.studentId) return tolak("Akun ini tidak terhubung ke data siswa.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data formulir tidak valid." }, { status: 400 });
  }

  const parsed = transferSchema.safeParse({
    invoiceId: form.get("invoiceId"),
    nominal: form.get("nominal"),
    tanggal: form.get("tanggal"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid." },
      { status: 400 }
    );
  }
  const { invoiceId, nominal, tanggal } = parsed.data;

  const bukti = form.get("bukti");
  if (!(bukti instanceof File) || bukti.size === 0) {
    return NextResponse.json({ error: "Bukti transfer wajib diupload." }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { id: true, nama: true, memberId: true } } },
  });
  if (!invoice) return tidakKetemu("Tagihan tidak ditemukan.");
  if (invoice.studentId !== u.studentId)
    return tolak("Tagihan ini bukan milik Anda.");
  if (invoice.status === "LUNAS")
    return NextResponse.json({ error: "Tagihan sudah lunas." }, { status: 409 });
  if (invoice.status === "MENUNGGU_VERIFIKASI")
    return NextResponse.json(
      { error: "Tagihan ini sudah memiliki pembayaran yang menunggu verifikasi." },
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

  // Simpan bukti: Telegram dulu (bila bot dikonfigurasi), fallback lokal.
  // Validasi magic bytes + 2MB di dalam simpanFile.
  const simpan = await simpanFile(
    bukti,
    "bukti",
    `bukti-${invoice.student.memberId}-${invoice.periode}.jpg`,
    `Bukti ${invoice.student.nama} (${invoice.student.memberId}) - ${labelPeriode(invoice.periode)} ${rupiah(nominal)}`
  );
  if (!simpan.ok) return NextResponse.json({ error: simpan.error }, { status: 400 });

  try {
    const payment = await prisma.$transaction(async (tx) => {
      // Kunci baris invoice: dua submit bersamaan untuk tagihan yang sama
      // tidak bisa lolos ganda (§60). Berlaku walau partial unique index
      // belum diterapkan di database (proyek memakai `db push`).
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const bentrok = await tx.payment.findFirst({
        where: { invoiceId, status: { in: ["MENUNGGU_VERIFIKASI", "LUNAS"] } },
        select: { id: true },
      });
      if (bentrok) throw new Error("SUDAH_ADA");

      const p = await tx.payment.create({
        data: {
          invoiceId,
          studentId: invoice.studentId,
          nominal,
          metode: "TRANSFER",
          tanggal,
          status: "MENUNGGU_VERIFIKASI",
        },
      });
      await tx.paymentProof.create({ data: { paymentId: p.id, url: simpan.ref } });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "MENUNGGU_VERIFIKASI" } });
      return p;
    });

    await kirimNotifikasi(
      u.id,
      "Pembayaran diterima",
      `Pembayaran iuran ${labelPeriode(invoice.periode)} sebesar ${rupiah(nominal)} telah diterima dan menunggu verifikasi admin.`,
      "PEMBAYARAN"
    );
    await catatAudit(u.id, "TRANSFER_DISUBMIT", "Payment", payment.id, {
      invoiceId,
      nominal,
    });

    return NextResponse.json(
      { data: payment, pesan: "Pembayaran terkirim dan menunggu verifikasi admin." },
      { status: 201 }
    );
  } catch (e) {
    // Bersihkan file yatim bila transaksi gagal (lokal dihapus; ref Telegram diabaikan).
    await hapusFile(simpan.ref);
    if (e instanceof Error && e.message === "SUDAH_ADA") {
      return NextResponse.json(
        { error: "Tagihan ini sudah memiliki pembayaran yang diproses." },
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
