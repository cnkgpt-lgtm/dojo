import { NextResponse } from "next/server";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { skalaPenilaianSchema } from "@/lib/validasi";
import { getSkalaPenilaian, setSkalaPenilaian } from "@/lib/sabuk";
import { catatAudit } from "@/lib/audit";

/** GET /api/pengaturan/skala-penilaian — skala aktif (semua role yang login). */
export async function GET() {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const skala = await getSkalaPenilaian();
  return NextResponse.json({ data: { skala } });
}

/** PUT /api/pengaturan/skala-penilaian — ubah skala (admin, §35). */
export async function PUT(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengatur skala penilaian.");

  const body = await req.json().catch(() => null);
  const parsed = skalaPenilaianSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }

  await setSkalaPenilaian(parsed.data.skala);
  await catatAudit(u.id, "UBAH_SKALA_PENILAIAN", "Setting", "skalaPenilaian", {
    skala: parsed.data.skala,
  });
  return NextResponse.json({ data: { skala: parsed.data.skala } });
}
