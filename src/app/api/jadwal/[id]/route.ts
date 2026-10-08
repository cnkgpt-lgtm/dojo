import { NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/db";
import { sesiApi, butuhLogin, tolak, tidakKetemu, dojoIdsUntukSensei } from "@/lib/api-auth";
import { jadwalUpdateSchema } from "@/lib/validasi";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasiSiswaDojo } from "@/lib/notifikasi";
import { NAMA_HARI } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

/** Ambil jadwal bila boleh diakses user (baca). */
async function jadwalTerbaca(id: string, u: NonNullable<Awaited<ReturnType<typeof sesiApi>>>) {
  const j = await prisma.schedule.findUnique({
    where: { id },
    include: {
      dojo: {
        select: { id: true, nama: true, latitude: true, longitude: true, radiusAbsensi: true },
      },
      coach: { select: { id: true, nama: true } },
    },
  });
  if (!j) return null;
  if (u.role === "ADMIN") {
    if (u.scopeDojoId && j.dojoId !== u.scopeDojoId) return null;
    return j;
  }
  if (u.role === "SENSEI") {
    const ids = await dojoIdsUntukSensei(u.coachId);
    return ids.includes(j.dojoId) ? j : null;
  }
  // SISWA: hanya jadwal aktif dojonya
  if (!u.studentId) return null;
  const siswa = await prisma.student.findUnique({
    where: { id: u.studentId },
    select: { dojoId: true },
  });
  if (!siswa || siswa.dojoId !== j.dojoId || !j.isActive) return null;
  return j;
}

export async function GET(_req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  const { id } = await ctx.params;
  const j = await jadwalTerbaca(id, u);
  if (!j) return tidakKetemu("Jadwal tidak ditemukan.");
  return NextResponse.json({ data: j });
}

/** PATCH /api/jadwal/[id] — ubah jadwal (admin only). */
export async function PATCH(req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat mengubah jadwal.");

  const { id } = await ctx.params;
  const lama = await prisma.schedule.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Jadwal tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat mengubah jadwal di dojo Anda.");

  const body = await req.json().catch(() => null);
  const parsed = jadwalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data jadwal tidak valid." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const dojoIdBaru = data.dojoId ?? lama.dojoId;
  if (u.scopeDojoId && dojoIdBaru !== u.scopeDojoId)
    return tolak("Anda hanya dapat memindahkan jadwal ke dojo Anda.");

  if (data.dojoId && data.dojoId !== lama.dojoId) {
    const dojo = await prisma.dojo.findUnique({ where: { id: data.dojoId } });
    if (!dojo || !dojo.isActive)
      return NextResponse.json({ error: "Dojo tidak ditemukan atau tidak aktif." }, { status: 400 });
  }
  if (data.coachId) {
    const coach = await prisma.coach.findUnique({ where: { id: data.coachId } });
    if (!coach || !coach.isActive)
      return NextResponse.json({ error: "Sensei tidak ditemukan atau tidak aktif." }, { status: 400 });
    if (coach.dojoId && coach.dojoId !== dojoIdBaru)
      return NextResponse.json({ error: "Sensei tersebut terdaftar di dojo lain." }, { status: 400 });
  }

  // jamMulai/jamSelesai parsial: validasi silang dengan nilai lama.
  const jamMulai = data.jamMulai ?? lama.jamMulai;
  const jamSelesai = data.jamSelesai ?? lama.jamSelesai;
  const [hm1, mm1] = jamMulai.split(":").map(Number);
  const [hm2, mm2] = jamSelesai.split(":").map(Number);
  if (hm2 * 60 + mm2 <= hm1 * 60 + mm1)
    return NextResponse.json(
      { error: "Jam selesai harus lebih besar dari jam mulai." },
      { status: 400 }
    );

  const diubah = await prisma.schedule.update({ where: { id }, data });
  await catatAudit(u.id, "UBAH_JADWAL", "Schedule", diubah.id, {
    namaLatihan: diubah.namaLatihan,
    jam: `${diubah.jamMulai}-${diubah.jamSelesai}`,
  });

  // Kabari siswa dojo terkait bila ada perubahan berarti (§43). Best-effort.
  {
    const deskripsi = `${diubah.namaLatihan}, ${NAMA_HARI[diubah.hari] ?? diubah.hari} ${diubah.jamMulai}-${diubah.jamSelesai}`;
    let judul: string | null = null;
    let isi = "";
    if (lama.isActive && !diubah.isActive) {
      judul = "Jadwal latihan dinonaktifkan";
      isi = `Jadwal latihan dinonaktifkan: ${deskripsi}.`;
    } else if (!lama.isActive && diubah.isActive) {
      judul = "Jadwal latihan diaktifkan kembali";
      isi = `Jadwal latihan diaktifkan kembali: ${deskripsi}.`;
    } else if (
      lama.namaLatihan !== diubah.namaLatihan ||
      lama.hari !== diubah.hari ||
      lama.jamMulai !== diubah.jamMulai ||
      lama.jamSelesai !== diubah.jamSelesai ||
      lama.coachId !== diubah.coachId
    ) {
      judul = "Jadwal latihan diperbarui";
      isi = `Jadwal latihan diperbarui: ${deskripsi}.`;
    }
    if (judul) {
      void kirimNotifikasiSiswaDojo(diubah.dojoId, judul, isi, "JADWAL");
    }
  }
  return NextResponse.json({ data: diubah });
}

/** DELETE /api/jadwal/[id] — hapus jadwal (admin only). Ditolak bila sudah ada absensi. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const u = await sesiApi();
  if (!u) return butuhLogin();
  if (u.role !== "ADMIN") return tolak("Hanya admin yang dapat menghapus jadwal.");

  const { id } = await ctx.params;
  const lama = await prisma.schedule.findUnique({ where: { id } });
  if (!lama) return tidakKetemu("Jadwal tidak ditemukan.");
  if (u.scopeDojoId && lama.dojoId !== u.scopeDojoId)
    return tolak("Anda hanya dapat menghapus jadwal di dojo Anda.");

  try {
    await prisma.schedule.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "Jadwal tidak dapat dihapus karena sudah memiliki data absensi. Nonaktifkan saja." },
        { status: 409 }
      );
    }
    throw e;
  }
  await catatAudit(u.id, "HAPUS_JADWAL", "Schedule", id, { namaLatihan: lama.namaLatihan });
  // Kabari siswa dojo terkait (§43). Best-effort: tak menggagalkan respons.
  void kirimNotifikasiSiswaDojo(
    lama.dojoId,
    "Jadwal latihan dibatalkan",
    `Jadwal latihan dibatalkan: ${lama.namaLatihan}, ${NAMA_HARI[lama.hari] ?? lama.hari} ${lama.jamMulai}-${lama.jamSelesai}.`,
    "JADWAL"
  );
  return NextResponse.json({ ok: true });
}
