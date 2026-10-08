"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PenilaianRow({ id }: { id: string }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [galat, setGalat] = useState("");

  async function hapus() {
    // Konfirmasi inline dua langkah (bukan dialog confirm() bawaan browser).
    if (!konfirmasi) {
      setKonfirmasi(true);
      return;
    }
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch(`/api/penilaian/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menghapus.");
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setSibuk(false);
      setKonfirmasi(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <Link
          href={`/dashboard/penilaian/${id}/ubah`}
          className="brutal-btn brutal-btn-light"
        >
          Ubah
        </Link>
        <button
          onClick={hapus}
          disabled={sibuk}
          className={`brutal-btn ${konfirmasi ? "brutal-btn-warn" : "brutal-btn-danger"}`}
        >
          {sibuk ? "Menghapus…" : konfirmasi ? "Yakin hapus?" : "Hapus"}
        </button>
      </div>
      {galat && <p className="mt-1 text-xs font-medium text-red-600">{galat}</p>}
    </div>
  );
}
