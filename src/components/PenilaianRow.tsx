"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PenilaianRow({ id }: { id: string }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);

  async function hapus() {
    if (!confirm("Hapus penilaian ini?")) return;
    setSibuk(true);
    try {
      const res = await fetch(`/api/penilaian/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menghapus.");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <Link
        href={`/dashboard/penilaian/${id}/ubah`}
        className="rounded-lg px-3 py-1.5 text-xs font-bold text-dojo-700 ring-1 ring-dojo-700/30"
      >
        Ubah
      </Link>
      <button
        onClick={hapus}
        disabled={sibuk}
        className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-50"
      >
        {sibuk ? "Menghapus…" : "Hapus"}
      </button>
    </div>
  );
}
