import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "./db";
import type { SesiPengguna } from "./authz";

/** Sesi untuk API route: kembalikan null bila tidak login (route menjawab 401 JSON). */
export async function sesiApi(): Promise<SesiPengguna | null> {
  const sesi = await auth();
  const u = sesi?.user as unknown as SesiPengguna | undefined;
  if (!u?.id || !u?.role) return null;
  return u;
}

export function butuhLogin(): NextResponse {
  return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
}

export function tolak(pesan: string): NextResponse {
  return NextResponse.json({ error: pesan }, { status: 403 });
}

export function tidakKetemu(pesan: string): NextResponse {
  return NextResponse.json({ error: pesan }, { status: 404 });
}

/**
 * Daftar dojoId yang menjadi tanggung jawab seorang sensei:
 * dojo profilnya + dojo dari jadwal yang ditugaskan padanya (§6, §59.15).
 */
export async function dojoIdsUntukSensei(coachId: string | null): Promise<string[]> {
  if (!coachId) return [];
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { schedules: { select: { dojoId: true } } },
  });
  if (!coach) return [];
  const ids = new Set<string>();
  if (coach.dojoId) ids.add(coach.dojoId);
  for (const s of coach.schedules) ids.add(s.dojoId);
  return [...ids];
}
