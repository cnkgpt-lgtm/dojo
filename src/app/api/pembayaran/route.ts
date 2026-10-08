import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";

const PER_HALAMAN_MAKS = 50;

/**
 * GET /api/pembayaran — daftar pembayaran (§23).
 * Admin: semua (scope dojo) + filter status/metode/dojo + search + pagination.
 * Siswa: hanya miliknya. Sensei: ditolak (§6).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role === "SENSEI") return tolak("Sensei tidak dapat mengakses data keuangan.");

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const metode = sp.get("metode")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "10", 10) || 10)
  );

  const where: Prisma.PaymentWhereInput = {};
  const STATUS_VALID = ["MENUNGGU_VERIFIKASI", "LUNAS", "DITOLAK"];
  if (status && STATUS_VALID.includes(status))
    where.status = status as Prisma.PaymentWhereInput["status"];
  if (metode === "TUNAI" || metode === "TRANSFER") where.metode = metode;
  if (q) {
    where.OR = [
      { student: { nama: { contains: q, mode: "insensitive" } } },
      { student: { memberId: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.invoice = { dojoId: u.scopeDojoId };
    } else if (sp.get("dojo")) {
      where.invoice = { dojoId: sp.get("dojo")! };
    }
  } else {
    if (!u.studentId) return tolak("Akun ini tidak terhubung ke data siswa.");
    where.studentId = u.studentId;
  }

  const [total, data] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      include: {
        student: { select: { id: true, nama: true, memberId: true } },
        invoice: {
          select: { id: true, periode: true, nominal: true, dojo: { select: { id: true, nama: true } } },
        },
        proof: { select: { url: true } },
        petugas: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data,
    meta: { halaman, perHalaman, total, totalHalaman: Math.max(1, Math.ceil(total / perHalaman)) },
  });
}
