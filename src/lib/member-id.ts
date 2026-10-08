import { prisma } from "./db";

/**
 * Kandidat Member ID berikutnya: KRT-XXXXXX, 6 digit sequential (§9, §59.1).
 * Unik dijamin oleh constraint database + retry di route (lihat POST /api/siswa).
 * `offset` dipakai saat retry agar kandidat selalu maju.
 */
export async function kandidatMemberId(offset = 0): Promise<string> {
  const semua = await prisma.student.findMany({ select: { memberId: true } });
  let maks = 0;
  for (const s of semua) {
    const cocok = /^KRT-(\d{6})$/.exec(s.memberId);
    if (cocok) maks = Math.max(maks, parseInt(cocok[1], 10));
  }
  return `KRT-${String(maks + 1 + offset).padStart(6, "0")}`;
}
