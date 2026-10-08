import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

export type SesiPengguna = {
  id: string;
  name: string;
  role: Role;
  scopeDojoId: string | null;
  studentId: string | null;
  coachId: string | null;
};

/** Ambil sesi; lempar ke /login bila tidak ada sesi valid. */
export async function wajibLogin(): Promise<SesiPengguna> {
  const sesi = await auth();
  const u = sesi?.user as unknown as SesiPengguna | undefined;
  if (!u?.id || !u?.role) redirect("/login");
  return u;
}

/** Guard per-role (§6): siswa tak boleh masuk area admin, dst. ADMIN boleh ke mana saja. */
export async function wajibRole(...roles: Role[]): Promise<SesiPengguna> {
  const u = await wajibLogin();
  if (u.role !== "ADMIN" && !roles.includes(u.role)) redirect("/dashboard");
  return u;
}

/**
 * Filter scope dojo untuk query admin (§5):
 * - ADMIN pusat (scopeDojoId null)  -> {} (semua dojo)
 * - ADMIN dojo (scopeDojoId terisi)  -> { dojoId: scopeDojoId }
 */
export function filterScopeDojo(u: SesiPengguna): { dojoId?: string } {
  if (u.role === "ADMIN" && u.scopeDojoId) return { dojoId: u.scopeDojoId };
  return {};
}
