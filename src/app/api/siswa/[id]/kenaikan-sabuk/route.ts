import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { kenaikanSabukSchema } from "@/lib/validasi";
import { simpanFoto, hapusFotoLama } from "@/lib/upload";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { catatAudit } from "@/lib/audit";

/**
 * POST /api/siswa/[id]/kenaikan-sabuk — catat kenaikan sabuk (multipart:
 * beltBaruId, tanggal, nilai?, keterangan?, foto?). Yang boleh: ADMIN
 * (semua/scope dojo) dan SENSEI untuk siswa dojonya (§6, §56).
 *
 * Aturan (§33, §34): sabuk baru harus lebih tinggi dari sabuk saat ini;
 * lompat >1 tingkat hanya boleh oleh ADMIN dan wajib ada keterangan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN" && u.role !== "SENSEI") {
    return tolak("Hanya admin atau sensei yang dapat mencatat kenaikan sabuk.");
  }

  const { id: studentId } = await params;
  const siswa = await prisma.student.findUnique({
    where: { id: studentId },
    include: { sabuk: true, dojo: { select: { nama: true } }, user: { select: { id: true } } },
  });
  if (!siswa) return tidakKetemu("Data siswa tidak ditemukan.");

  // Scope kewenangan (§59.15–16)
  if (u.role === "ADMIN" && u.scopeDojoId && siswa.dojoId !== u.scopeDojoId) {
    return tolak("Siswa ini di luar dojo yang menjadi tanggung jawab Anda.");
  }
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    if (!ids.includes(siswa.dojoId)) {
      return tolak("Anda hanya dapat mencatat kenaikan untuk siswa dojo Anda.");
    }
  }

  const form = await req.formData().catch(() => null);
  const parsed = kenaikanSabukSchema.safeParse({
    beltBaruId: String(form?.get("beltBaruId") ?? "").trim(),
    tanggal: form?.get("tanggal"),
    nilai: form?.get("nilai") ? String(form.get("nilai")) : null,
    keterangan: form?.get("keterangan") ? String(form.get("keterangan")) : null,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 }
    );
  }
  const { beltBaruId, tanggal, nilai, keterangan } = parsed.data;

  const beltBaru = await prisma.belt.findUnique({ where: { id: beltBaruId } });
  if (!beltBaru || !beltBaru.isActive) {
    return NextResponse.json({ error: "Sabuk baru tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const urutanLama = siswa.sabuk?.urutan ?? 0;
  if (beltBaru.urutan <= urutanLama) {
    return NextResponse.json(
      { error: "Sabuk baru harus lebih tinggi dari sabuk saat ini." },
      { status: 422 }
    );
  }
  const lompat = beltBaru.urutan - urutanLama;
  if (lompat > 1) {
    if (u.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Kenaikan lebih dari satu tingkat hanya dapat dicatat oleh admin." },
        { status: 403 }
      );
    }
    if (!keterangan || keterangan.trim().length < 3) {
      return NextResponse.json(
        { error: "Kenaikan lebih dari satu tingkat wajib disertai keterangan." },
        { status: 400 }
      );
    }
  }

  // Foto dokumentasi opsional (§34)
  let fotoUrl: string | null = null;
  const file = form?.get("foto");
  if (file instanceof File && file.size > 0) {
    const simpan = await simpanFoto(file, "sabuk");
    if (!simpan.ok) {
      return NextResponse.json({ error: simpan.error }, { status: 400 });
    }
    fotoUrl = simpan.url;
  }

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      const riwayat = await tx.studentBeltHistory.create({
        data: {
          studentId: siswa.id,
          sabukLamaId: siswa.sabukId,
          sabukBaruId: beltBaru.id,
          tanggal,
          pengujiId: u.id,
          coachId: u.coachId,
          nilai: nilai?.trim() || null,
          keterangan: keterangan?.trim() || null,
          fotoUrl,
        },
      });
      await tx.student.update({ where: { id: siswa.id }, data: { sabukId: beltBaru.id } });
      return riwayat;
    });

    await catatAudit(u.id, "KENAIKAN_SABUK", "StudentBeltHistory", hasil.id, {
      siswa: siswa.nama,
      dari: siswa.sabuk?.nama ?? "-",
      ke: beltBaru.nama,
    });
    await kirimNotifikasi(
      siswa.user?.id,
      "Kenaikan sabuk",
      `Selamat! Sabuk Anda naik dari ${siswa.sabuk?.nama ?? "-"} ke ${beltBaru.nama}.`,
      "SABUK"
    );

    return NextResponse.json({ data: hasil }, { status: 201 });
  } catch (e) {
    if (fotoUrl) await hapusFotoLama(fotoUrl);
    throw e;
  }
}
