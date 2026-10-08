import { prisma, Prisma } from "./db";
import { dojoIdsUntukSensei } from "./api-auth";
import type { SesiPengguna } from "./authz";

/**
 * Logika visibilitas pengumuman Phase 7 (§44).
 * - ADMIN: semua (admin dojo: yang global + dojonya).
 * - SISWA: aktif + dalam rentang tanggal + target SEMUA, atau DOJO miliknya.
 * - SENSEI: aktif + dalam rentang tanggal + target SEMUA / SENSEI, atau DOJO tanggung jawabnya.
 */

export const LABEL_TARGET: Record<string, string> = {
  SEMUA: "Semua",
  DOJO: "Dojo",
  SENSEI: "Sensei",
};

/** Batasan aktif + rentang tanggal untuk non-admin. */
function whereTayang(): Prisma.AnnouncementWhereInput {
  const kini = new Date();
  return {
    isActive: true,
    AND: [
      { OR: [{ tanggalMulai: null }, { tanggalMulai: { lte: kini } }] },
      { OR: [{ tanggalSelesai: null }, { tanggalSelesai: { gte: kini } }] },
    ],
  };
}

export async function wherePengumumanTerbaca(
  u: SesiPengguna
): Promise<Prisma.AnnouncementWhereInput> {
  if (u.role === "ADMIN") {
    if (u.scopeDojoId) return { OR: [{ dojoId: null }, { dojoId: u.scopeDojoId }] };
    return {};
  }

  if (u.role === "SISWA") {
    if (!u.studentId) return { id: "__tak-ada__" };
    const siswa = await prisma.student.findUnique({
      where: { id: u.studentId },
      select: { dojoId: true },
    });
    if (!siswa) return { id: "__tak-ada__" };
    return {
      ...whereTayang(),
      OR: [{ target: "SEMUA" }, { AND: [{ target: "DOJO" }, { dojoId: siswa.dojoId }] }],
    };
  }

  // SENSEI
  const ids = await dojoIdsUntukSensei(u.coachId);
  return {
    ...whereTayang(),
    OR: [
      { target: "SEMUA" },
      { target: "SENSEI" },
      { AND: [{ target: "DOJO" }, { dojoId: { in: ids.length > 0 ? ids : ["__tak-ada__"] } }] },
    ],
  };
}

/** Label target untuk badge UI. */
export function labelTarget(target: string): string {
  return LABEL_TARGET[target] ?? target;
}
