import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const kredensialSchema = z.object({
  identitas: z.string().min(1, "Username, nomor HP, atau email wajib diisi"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Username / HP / Email & Kata Sandi",
      credentials: {
        identitas: { label: "Username / Nomor HP / Email", type: "text" },
        password: { label: "Kata Sandi", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = kredensialSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const identitas = parsed.data.identitas.trim();

        // Login dengan username ATAU nomor HP ATAU email (§7)
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: identitas.toLowerCase() },
              { phone: identitas },
              { email: identitas.toLowerCase() },
            ],
          },
          include: { student: { select: { id: true } }, coach: { select: { id: true } } },
        });
        if (!user || !user.isActive) return null;
        const cocok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!cocok) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          sessionVersion: user.sessionVersion,
          scopeDojoId: user.scopeDojoId,
          studentId: user.student?.id ?? null,
          coachId: user.coach?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        token.scopeDojoId = (user as { scopeDojoId?: string | null }).scopeDojoId ?? null;
        token.studentId = (user as { studentId?: string | null }).studentId ?? null;
        token.coachId = (user as { coachId?: string | null }).coachId ?? null;
        return token;
      }
      // Validasi sesi terhadap database setiap request: token lama langsung
      // mati bila akun dinonaktifkan, role diubah, atau password diganti
      // (sessionVersion dinaikkan).
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            sessionVersion: true,
            role: true,
            isActive: true,
            scopeDojoId: true,
            student: { select: { id: true } },
            coach: { select: { id: true } },
          },
        });
        if (!dbUser || !dbUser.isActive || dbUser.sessionVersion !== token.sv) {
          return null; // paksa logout
        }
        token.role = dbUser.role;
        token.scopeDojoId = dbUser.scopeDojoId;
        token.studentId = dbUser.student?.id ?? null;
        token.coachId = dbUser.coach?.id ?? null;
      }
      return token;
    },
    session({ session, token }) {
      const u = session.user as {
        id?: string;
        role?: string;
        scopeDojoId?: string | null;
        studentId?: string | null;
        coachId?: string | null;
      };
      if (u) {
        u.id = token.id as string;
        u.role = token.role as string;
        u.scopeDojoId = (token.scopeDojoId as string | null) ?? null;
        u.studentId = (token.studentId as string | null) ?? null;
        u.coachId = (token.coachId as string | null) ?? null;
      }
      return session;
    },
  },
});
