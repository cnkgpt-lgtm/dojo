import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { statusTampilan } from "@/lib/iuran";

/**
 * GET /api/tunggakan — rekap tunggakan per siswa (§24).
 * Admin: semua siswa yang punya invoice BELUM_BAYAR/TERLAMBAT (scope dojo) + total.
 * Siswa: hanya miliknya. Sensei: ditolak (§6).
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role === "SENSEI") return tolak("Sensei tidak dapat mengakses data keuangan.");

  const sp = new URL(req.url).searchParams;
  const dojoFilter = sp.get("dojo")?.trim() ?? "";

  const where: Prisma.InvoiceWhereInput = { status: "BELUM_BAYAR" };
  if (u.role === "ADMIN") {
    if (u.scopeDojoId) {
      where.dojoId = u.scopeDojoId;
    } else if (dojoFilter) {
      where.dojoId = dojoFilter;
    }
  } else {
    if (!u.studentId) return tolak("Akun ini tidak terhubung ke data siswa.");
    where.studentId = u.studentId;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ jatuhTempo: "asc" }],
    include: {
      student: {
        select: { id: true, nama: true, memberId: true, dojo: { select: { id: true, nama: true } } },
      },
    },
  });

  // Kelompokkan per siswa; TERLAMBAT dihitung dinamis (§20).
  const perSiswa = new Map<
    string,
    {
      student: { id: string; nama: string; memberId: string; dojo: string };
      invoices: { id: string; periode: string; nominal: number; jatuhTempo: Date; statusTampilan: string }[];
      total: number;
    }
  >();
  for (const inv of invoices) {
    const st = statusTampilan(inv);
    if (st !== "BELUM_BAYAR" && st !== "TERLAMBAT") continue;
    let grup = perSiswa.get(inv.student.id);
    if (!grup) {
      grup = {
        student: {
          id: inv.student.id,
          nama: inv.student.nama,
          memberId: inv.student.memberId,
          dojo: inv.student.dojo.nama,
        },
        invoices: [],
        total: 0,
      };
      perSiswa.set(inv.student.id, grup);
    }
    grup.invoices.push({
      id: inv.id,
      periode: inv.periode,
      nominal: inv.nominal,
      jatuhTempo: inv.jatuhTempo,
      statusTampilan: st,
    });
    grup.total += inv.nominal;
  }

  const data = [...perSiswa.values()].sort((a, b) => b.total - a.total);
  const grandTotal = data.reduce((s, g) => s + g.total, 0);

  return NextResponse.json({
    data,
    meta: { jumlahSiswa: data.length, grandTotal },
  });
}
