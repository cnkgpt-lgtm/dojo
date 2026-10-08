import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

/**
 * Seed Phase 1 — data demo DojoKu.
 * Idempoten: aman dijalankan ulang (upsert semua).
 *
 * Kredensial demo (JANGAN dipakai di produksi): password "demo1234".
 */

const DEMO_PASSWORD = "demo1234";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1 organisasi demo
  const org = await prisma.organization.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Perguruan Karate Demo" },
  });

  // 2 dojo demo (Makassar, dengan lat/long + radius)
  const dojoA = await prisma.dojo.upsert({
    where: { kode: "DJK-MKS-01" },
    update: {},
    create: {
      organizationId: org.id,
      kode: "DJK-MKS-01",
      nama: "Dojo Panakkukang",
      alamat: "Jl. AP Pettarani No. 1, Makassar",
      latitude: -5.1578,
      longitude: 119.4317,
      radiusAbsensi: 100,
      kontak: "0811-0000-0001",
    },
  });
  const dojoB = await prisma.dojo.upsert({
    where: { kode: "DJK-MKS-02" },
    update: {},
    create: {
      organizationId: org.id,
      kode: "DJK-MKS-02",
      nama: "Dojo Tamalanrea",
      alamat: "Jl. Perintis Kemerdekaan No. 10, Makassar",
      latitude: -5.1283,
      longitude: 119.4851,
      radiusAbsensi: 100,
      kontak: "0811-0000-0002",
    },
  });

  // Kategori keuangan bawaan (§27, §28)
  for (const nama of ["Iuran Bulanan", "Pendaftaran", "Ujian", "Seragam", "Kegiatan", "Turnamen", "Lainnya"]) {
    await prisma.revenueCategory.upsert({ where: { nama }, update: {}, create: { nama } });
  }
  for (const nama of ["Sewa Tempat", "Peralatan Latihan", "Seragam", "Transportasi", "Konsumsi", "Turnamen", "Operasional", "Honor", "Administrasi", "Lainnya"]) {
    await prisma.expenseCategory.upsert({ where: { nama }, update: {}, create: { nama } });
  }

  // Tingkatan sabuk bawaan (§33)
  const sabuk: { nama: string; warnaHex: string; deskripsi: string }[] = [
    { nama: "PUTIH", warnaHex: "#f8fafc", deskripsi: "Tingkatan dasar" },
    { nama: "KUNING", warnaHex: "#eab308", deskripsi: "Tingkatan pemula" },
    { nama: "HIJAU", warnaHex: "#16a34a", deskripsi: "Tingkatan menengah awal" },
    { nama: "BIRU", warnaHex: "#2563eb", deskripsi: "Tingkatan menengah" },
    { nama: "COKELAT", warnaHex: "#92400e", deskripsi: "Tingkatan lanjutan" },
    { nama: "HITAM", warnaHex: "#111827", deskripsi: "Tingkatan ahli" },
  ];
  for (let i = 0; i < sabuk.length; i++) {
    await prisma.belt.upsert({
      where: { nama: sabuk[i].nama },
      update: { urutan: i + 1, warnaHex: sabuk[i].warnaHex, deskripsi: sabuk[i].deskripsi },
      create: {
        nama: sabuk[i].nama,
        urutan: i + 1,
        warnaHex: sabuk[i].warnaHex,
        deskripsi: sabuk[i].deskripsi,
      },
    });
  }

  // Tarif default organisasi agar generate tagihan langsung bisa diuji (§18).
  // Idempoten: cari berdasarkan nama + cakupan default.
  const tarifDefault = await prisma.feeSetting.findFirst({
    where: { nama: "Iuran Bulanan Demo", dojoId: null, studentId: null },
  });
  if (!tarifDefault) {
    await prisma.feeSetting.create({
      data: { nama: "Iuran Bulanan Demo", nominal: 100000, hariJatuhTempo: 10, isActive: true },
    });
  }
  const sabukPutih = await prisma.belt.findUniqueOrThrow({ where: { nama: "PUTIH" } });

  // 1 admin demo (pusat: semua dojo)
  await prisma.user.upsert({
    where: { phone: "081100000001" },
    update: {},
    create: {
      name: "Admin Demo",
      phone: "081100000001",
      email: "admin@dojoku.demo",
      passwordHash,
      role: "ADMIN",
    },
  });

  // 1 sensei demo (Dojo A)
  const senseiUser = await prisma.user.upsert({
    where: { phone: "081100000002" },
    update: {},
    create: {
      name: "Sensei Ahmad",
      phone: "081100000002",
      email: "sensei@dojoku.demo",
      passwordHash,
      role: "SENSEI",
    },
  });
  const coach = await prisma.coach.upsert({
    where: { userId: senseiUser.id },
    update: {},
    create: {
      userId: senseiUser.id,
      dojoId: dojoA.id,
      nama: "Sensei Ahmad",
      phone: "081100000002",
      email: "sensei@dojoku.demo",
      nomorIdentitas: "SNS-0001",
      spesialisasi: "Kata & Kumite",
    },
  });

  // 2 siswa demo (Dojo A), Member ID KRT-000001 dst (§9)
  const siswaData = [
    { nama: "Ahmad Fauzi", phone: "081100000011", email: "ahmad@dojoku.demo", memberId: "KRT-000001" },
    { nama: "Budi Santoso", phone: "081100000012", email: "budi@dojoku.demo", memberId: "KRT-000002" },
  ];
  for (const s of siswaData) {
    const user = await prisma.user.upsert({
      where: { phone: s.phone },
      update: {},
      create: {
        name: s.nama,
        phone: s.phone,
        email: s.email,
        passwordHash,
        role: "SISWA",
      },
    });
    await prisma.student.upsert({
      where: { memberId: s.memberId },
      update: {},
      create: {
        userId: user.id,
        dojoId: dojoA.id,
        memberId: s.memberId,
        nama: s.nama,
        phone: s.phone,
        email: s.email,
        tanggalBergabung: new Date(),
        sabukId: sabukPutih.id,
      },
    });
  }

  // 1 jadwal contoh (Dojo A)
  await prisma.schedule.upsert({
    where: { id: "demo-jadwal-1" },
    update: {},
    create: {
      id: "demo-jadwal-1",
      dojoId: dojoA.id,
      hari: "SENIN",
      jamMulai: "16:00",
      jamSelesai: "18:00",
      coachId: coach.id,
      namaLatihan: "Latihan Rutin Kihon & Kata",
    },
  });

  console.log("Seed selesai.");
  console.log("Dojo demo:", dojoA.nama, "|", dojoB.nama);
  console.log("Login demo — Admin : 081100000001 / demo1234");
  console.log("Login demo — Sensei: 081100000002 / demo1234");
  console.log("Login demo — Siswa : 081100000011 / demo1234 (atau 081100000012)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
