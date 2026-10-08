import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { absensiKoreksiSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
type Sesi = NonNullable<Awaited<ReturnType<typeof sesiApi>>>;

/** Absensi boleh dilihat: admin (scope), sensei (dojo tanggung jawab), siswa (miliknya). */
async function absensiTerbaca(id: string, u: Sesi) {
  const a = await prisma.attendance.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, nama: true, memberId: true, foto: true } },
      schedule: {
        select: { id: true, namaLatihan: true, hari: true, jamMulai: true, jamSelesai: true },
      },
      dojo: { select: { id: true, nama: true } },
      photo: { select: { url: true } },
      location: { select: { latitude: true, longitude: true, jarakMeter: true, statusGps: true } },
    },
  });
  if (!a) return null;
  if (u.role === "ADMIN") {
    if (u.scopeDojoId && a.dojoId !== u.scopeDojoId) return null;
    return a;
  }
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    return ids.includes(a.dojoId) ? a : null;
  }
  return u.studentId === a.studentId ? a : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await ctx.params;
  const a = await absensiTerbaca(id, u);
  if (!a) return tidakKetemu("Data absensi tidak ditemukan.");
  return NextResponse.json({ data: a });
}

/**
 * PATCH /api/absensi/[id] — koreksi status absensi (admin only, §6).
 * Koreksi mengubah status, bukan menghapus jejak: perubahan dicatat di audit log (§45).
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengoreksi absensi.");

  const { id } = await ctx.params;
  const lama = await prisma.attendance.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Data absensi tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mengoreksi absensi di dojo Anda.");

  const body = await req.json().catch(() => null);
  const parsed = absensiKoreksiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data koreksi tidak valid." },
      { status: 400 }
    );
  }

  const diubah = await prisma.attendance.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  await catatAudit(u.id, "KOREKSI_ABSENSI", "Attendance", diubah.id, {
    statusLama: lama.status,
    statusBaru: diubah.status,
    catatan: parsed.data.catatan ?? null,
  });
  return NextResponse.json({ data: diubah });
}
