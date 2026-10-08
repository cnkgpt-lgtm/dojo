import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { statusTampilan } from "@/lib/iuran";

const PER_HALAMAN_MAKS = 50;

/**
 * GET /api/tagihan — daftar tagihan (§23).
 * Admin: semua (scope dojo) + filter dojo/periode/status + pagination.
 * Siswa: hanya miliknya. Sensei: ditolak (tak boleh lihat keuangan, §6).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role === "SENSEI") return tolak("Sensei tidak dapat mengakses data keuangan.");

  const sp = new URL(req.url).searchParams;
  const periode = sp.get("periode")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const halaman = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perHalaman = Math.min(
    PER_HALAMAN_MAKS,
    Math.max(1, parseInt(sp.get("perPage") ?? "10", 10) || 10)
  );

  const where: Prisma.InvoiceWhereInput = {};
  if (periode) where.periode = periode;
  const STATUS_VALID = ["BELUM_BAYAR", "MENUNGGU_VERIFIKASI", "LUNAS", "DITOLAK", "TERLAMBAT", "DIBATALKAN"];
  if (status && STATUS_VALID.includes(status)) {
    if (status === "TERLAMBAT") {
      // TERLAMBAT dihitung dinamis — di DB tersimpan sebagai BELUM_BAYAR yang lewat jatuh tempo.
      where.status = "BELUM_BAYAR";
    } else {
      where.status = status as Prisma.InvoiceWhereInput["status"];
    }
  }

  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (sp.get("dojo")) {
      where.dojoId = sp.get("dojo")!;
    }
  } else {
    // SISWA
    if (!u.studentId) return tolak("Akun ini tidak terhubung ke data siswa.");
    where.studentId = u.studentId;
  }

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ periode: "desc" }, { jatuhTempo: "asc" }],
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
      include: {
        student: { select: { id: true, nama: true, memberId: true } },
        dojo: { select: { id: true, nama: true } },
      },
    }),
  ]);

  // TERLAMBAT dihitung dinamis saat baca (§20, §67) — tanpa mengandalkan cron.
  let data = rows.map((r) => ({ ...r, statusTampilan: statusTampilan(r) }));
  if (status === "TERLAMBAT") data = data.filter((r) => r.statusTampilan === "TERLAMBAT");

  return NextResponse.json({
    data,
    meta: { halaman, perHalaman, total, totalHalaman: Math.max(1, Math.ceil(total / perHalaman)) },
  });
}
