import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin } from "@/lib/api-auth";
import { profilUpdateSchema, profilAdminUpdateSchema } from "@/lib/validasi";
import { hapusFotoLama } from "@/lib/upload";
import { catatAudit } from "@/lib/audit";

/**
 * GET /api/profil — profil user yang login.
 * Siswa: data §36 (foto, nama, Member ID, dojo, sabuk, tgl bergabung, dst).
 * Kehadiran/iuran/penilaian menyusul di phase berikutnya.
 */
export async function GET() {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      scopeDojo: { select: { id: true, nama: true } },
    },
  });
  if (!user) return butuhLogin();

  let profil: unknown = null;
  if (u.role === "SISWA" && u.studentId) {
    profil = await prisma.student.findUnique({
      where: { id: u.studentId },
      include: { dojo: { select: { id: true, nama: true } }, sabuk: { select: { id: true, nama: true } } },
    });
  } else if (u.role === "SENSEI" && u.coachId) {
    profil = await prisma.coach.findUnique({
      where: { id: u.coachId },
      include: { dojo: { select: { id: true, nama: true } } },
    });
  }
  return NextResponse.json({ user, profil });
}

/**
 * PATCH /api/profil — ubah profil sendiri.
 * Siswa/Sensei: hanya foto, HP, email, alamat pada profil terhubung.
 * Admin: nama, HP, email pada akunnya. Role/dojo/status tidak dapat diubah.
 */
export async function PATCH(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const body = await req.json().catch(() => null);

  if (u.role === "ADMIN") {
    const parsed = profilAdminUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data profil tidak valid." },
        { status: 400 }
      );
    }
    try {
      const diubah = await prisma.user.update({
        where: { id: u.id },
        data: { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email ?? null },
        select: { id: true, name: true, phone: true, email: true, role: true },
      });
      await catatAudit(u.id, "UBAH_PROFIL", "User", u.id, { name: diubah.name });
      return NextResponse.json({ user: diubah, profil: null });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json(
          { error: "Nomor HP atau email sudah dipakai akun lain." },
          { status: 409 }
        );
      }
      throw e;
    }
  }

  const parsed = profilUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data profil tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (u.role === "SISWA") {
    if (!u.studentId) return NextResponse.json({ error: "Profil siswa belum terhubung." }, { status: 400 });
    const lama = await prisma.student.findUnique({ where: { id: u.studentId } });
    const diubah = await prisma.student.update({ where: { id: u.studentId }, data });
    if (data.foto && lama?.foto && data.foto !== lama.foto) await hapusFotoLama(lama.foto);
    await catatAudit(u.id, "UBAH_PROFIL", "Student", u.studentId, {});
    return NextResponse.json({ profil: diubah });
  }

  // SENSEI
  if (!u.coachId) return NextResponse.json({ error: "Profil sensei belum terhubung." }, { status: 400 });
  const lama = await prisma.coach.findUnique({ where: { id: u.coachId } });
  const diubah = await prisma.coach.update({ where: { id: u.coachId }, data });
  if (data.foto && lama?.foto && data.foto !== lama.foto) await hapusFotoLama(lama.foto);
  await catatAudit(u.id, "UBAH_PROFIL", "Coach", u.coachId, {});
  return NextResponse.json({ profil: diubah });
}
