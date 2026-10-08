import { prisma } from "@/lib/db";
import { wajibLogin } from "@/lib/authz";
import { NotifikasiList } from "@/components/NotifikasiList";

/** GET /dashboard/notifikasi — notifikasi in-app milik sendiri (§43). */
export default async function NotifikasiPage() {
  const u = await wajibLogin();

  const [data, belumDibaca] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: u.id, isRead: false } }),
  ]);

  return (
    <div className="anim-fade-up mx-auto max-w-3xl">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Notifikasi</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Pengingat iuran, kabar pembayaran, dan pengumuman untuk Anda.
      </p>
      <NotifikasiList
        awal={data.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        belumDibaca={belumDibaca}
      />
    </div>
  );
}
