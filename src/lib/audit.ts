import { prisma } from "./db";

/**
 * Catat aktivitas penting ke audit log (§45).
 * Kegagalan pencatatan tidak boleh menggagalkan operasi utama.
 */
export async function catatAudit(
  userId: string | null | undefined,
  aksi: string,
  entitas?: string,
  entitasId?: string,
  detail?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        aksi,
        entitas: entitas ?? null,
        entitasId: entitasId ?? null,
        detail: detail ? JSON.stringify(detail) : null,
      },
    });
  } catch {
    // abaikan: audit tidak boleh menggagalkan operasi utama
  }
}
