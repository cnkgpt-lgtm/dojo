import { NextResponse } from "next/server";
import { sesiApi, butuhLogin, tolak } from "@/lib/api-auth";
import { simpanFoto, type TipeUpload } from "@/lib/upload";

const TIPE_VALID: TipeUpload[] = ["siswa", "sensei", "profil"];

/**
 * POST /api/upload — unggah foto (multipart: foto + tipe).
 * Validasi: JPG/PNG/WebP via magic bytes, maksimal 2MB (§46).
 * Foto member (siswa/sensei) hanya boleh diunggah admin; foto profil oleh pemiliknya.
 */
export async function POST(req: Request) {
  const u = await sesiApi();
  if (!u) return butuhLogin();

  const form = await req.formData().catch(() => null);
  const file = form?.get("foto");
  const tipe = String(form?.get("tipe") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File foto wajib diunggah." }, { status: 400 });
  }
  if (!TIPE_VALID.includes(tipe as TipeUpload)) {
    return NextResponse.json({ error: "Tipe unggahan tidak valid." }, { status: 400 });
  }
  if (tipe !== "profil" && u.role !== "ADMIN") {
    return tolak("Hanya admin yang dapat mengunggah foto member.");
  }

  const hasil = await simpanFoto(file, tipe as TipeUpload);
  if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });
  return NextResponse.json({ url: hasil.url }, { status: 201 });
}
