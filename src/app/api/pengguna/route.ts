import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { catatAudit } from "@/lib/audit";
import { kandidatMemberId } from "@/lib/member-id";
import { z } from "zod";
import bcrypt from "bcryptjs";

const penggunaCreateSchema = z.object({
  nama: z.string().trim().min(3, "Nama minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
  phone: z.string().trim().min(9, "Nomor HP minimal 9 digit").max(16, "Nomor HP maksimal 16 digit"),
  email: z.string().trim().email("Format email tidak valid").max(100).nullish(),
  password: z.string().min(6, "Kata sandi minimal 6 karakter").max(100),
  role: z.enum(["ADMIN", "SENSEI", "SISWA"]),
  // Wajib untuk SENSEI/SISWA (dojo tempat bertugas/belajar).
  dojoId: z.string().min(1).nullish(),
  // Opsional untuk ADMIN: batasi kelola ke satu dojo.
  scopeDojoId: z.string().min(1).nullish(),
});

/**
 * GET /api/pengguna — daftar akun login (admin only).
 * Search nama/HP/email + filter role.
 */
export async function GET(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat melihat data pengguna.");

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const role = searchParams.get("role")?.trim();

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role === "ADMIN" || role === "SENSEI" || role === "SISWA") where.role = role;

  const data = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      scopeDojo: { select: { nama: true } },
      student: { select: { memberId: true } },
      coach: { select: { id: true } },
    },
  });
  return NextResponse.json({ data });
}

/**
 * POST /api/pengguna — buat akun login + pilih role (admin only).
 * SENSEI: dibuatkan profil Coach. SISWA: dibuatkan profil Student
 * (Member ID otomatis KRT-XXXXXX). ADMIN: akun saja.
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menambah pengguna.");

  const body = await req.json().catch(() => null);
  const parsed = penggunaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pengguna tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const perluDojo = data.role === "SENSEI" || data.role === "SISWA";
  if (perluDojo && !data.dojoId) {
    return NextResponse.json({ error: "Dojo wajib dipilih untuk role Sensei/Siswa." }, { status: 400 });
  }
  if (data.dojoId) {
    const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
    if (!dojo) return NextResponse.json({ error: "Dojo tidak ditemukan." }, { status: 400 });
  }
  if (data.scopeDojoId) {
    const sdo = await prisma.dojo.findUnique({ where: { id: data.scopeDojoId } });
    if (!sdo) return NextResponse.json({ error: "Dojo scope tidak ditemukan." }, { status: 400 });
  }

  const telpAda = await prisma.user.findFirst({ where: { phone: data.phone }, select: { id: true } });
  if (telpAda) return NextResponse.json({ error: "Nomor HP sudah dipakai akun lain." }, { status: 409 });
  if (data.email) {
    const emailAda = await prisma.user.findFirst({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });
    if (emailAda) return NextResponse.json({ error: "Email sudah dipakai akun lain." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const dibuat = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.nama,
        phone: data.phone,
        email: data.email ? data.email.toLowerCase() : null,
        passwordHash,
        role: data.role,
        scopeDojoId: data.role === "ADMIN" ? data.scopeDojoId ?? null : null,
      },
    });
    if (data.role === "SENSEI") {
      await tx.coach.create({
        data: {
          userId: user.id,
          dojoId: data.dojoId,
          nama: data.nama,
          phone: data.phone,
          email: data.email ? data.email.toLowerCase() : null,
        },
      });
    }
    if (data.role === "SISWA") {
      // Member ID unik dengan retry bila tabrakan.
      let student = null;
      for (let i = 0; i < 5 && !student; i++) {
        const memberId = await kandidatMemberId(i);
        try {
          student = await tx.student.create({
            data: {
              userId: user.id,
              dojoId: data.dojoId!,
              memberId,
              nama: data.nama,
              phone: data.phone,
              email: data.email ? data.email.toLowerCase() : null,
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
          throw e;
        }
      }
      if (!student) throw new Error("GAGAL_MEMBER_ID");
    }
    return user;
  }).catch((e) => {
    if (e instanceof Error && e.message === "GAGAL_MEMBER_ID") return null;
    throw e;
  });

  if (!dibuat) {
    return NextResponse.json({ error: "Gagal membuat Member ID unik. Coba lagi." }, { status: 409 });
  }

  await catatAudit(u.id, "TAMBAH_PENGGUNA", "User", dibuat.id, {
    nama: dibuat.name,
    role: dibuat.role,
  });
  return NextResponse.json(
    { data: { id: dibuat.id, role: dibuat.role }, pesan: "Akun pengguna berhasil dibuat." },
    { status: 201 }
  );
}
