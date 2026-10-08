"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { rupiah, formatTanggal} from "@/lib/format";
import { labelPeriode } from "@/lib/iuran";
import { BadgeMetode } from "@/components/BadgeIuran";

type Pending = {
  id: string;
  nominal: number;
  tanggal: Date;
  createdAt: Date;
  student: { nama: string; memberId: string };
  invoice: { periode: string; nominal: number };
  proof: { url: string } | null;
};

/** Kartu antrean verifikasi transfer: lihat bukti, APPROVE atau REJECT + alasan wajib. */
export function VerifikasiCard({ p }: { p: Pending }) {
  const router = useRouter();
  const [sibuk, setSibuk] = useState(false);
  const [modeTolak, setModeTolak] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [galat, setGalat] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);

  async function kirim(keputusan: "APPROVE" | "REJECT") {
    if (keputusan === "REJECT" && alasan.trim().length < 3) {
      setGalat("Alasan penolakan wajib diisi (minimal 3 karakter).");
      return;
    }
    // Konfirmasi inline dua langkah (bukan dialog confirm() bawaan browser).
    if (keputusan === "APPROVE" && !konfirmasi) {
      setKonfirmasi(true);
      return;
    }
    setSibuk(true);
    setGalat("");
    const r = await fetch(`/api/pembayaran/${p.id}/verifikasi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keputusan, alasan: alasan.trim() || null }),
    });
    const j = await r.json().catch(() => ({}));
    setSibuk(false);
    setKonfirmasi(false);
    if (!r.ok) {
      setGalat(j.error ?? "Gagal memverifikasi.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="sm:flex sm:gap-4">
        {p.proof?.url ? (
          <a href={`/api/pembayaran/${p.id}/bukti`} target="_blank" rel="noreferrer" className="block shrink-0">
            <Image
              src={`/api/pembayaran/${p.id}/bukti`}
              alt={`Bukti transfer ${p.student.nama}`}
              width={160}
              height={120}
              className="h-32 w-full rounded-xl object-cover ring-1 ring-slate-200 sm:w-40"
            />
          </a>
        ) : (
          <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">Bukti tidak tersedia.</p>
        )}
        <div className="mt-3 flex-1 sm:mt-0">
          <p className="font-bold">
            {p.student.nama} <span className="font-normal text-slate-500">({p.student.memberId})</span>
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            Iuran {labelPeriode(p.invoice.periode)} · transfer {formatTanggal(p.tanggal)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-extrabold">{rupiah(p.nominal)}</span>
            <BadgeMetode metode="TRANSFER" />
          </div>
          {p.nominal !== p.invoice.nominal && (
            <p className="mt-1 text-xs font-semibold text-orange-600">
              Nominal bukti berbeda dari tagihan ({rupiah(p.invoice.nominal)}). Periksa sebelum menyetujui.
            </p>
          )}
        </div>
      </div>

      {galat && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {galat}
        </p>
      )}

      {!modeTolak ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => kirim("APPROVE")}
            disabled={sibuk}
            className={`min-h-[48px] flex-1 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 ${
              konfirmasi ? "bg-amber-600" : "bg-emerald-700"
            }`}
          >
            {sibuk ? "Memproses..." : konfirmasi ? "Yakin, Setujui" : "Setujui"}
          </button>
          <button
            onClick={() => {
              setModeTolak(true);
              setKonfirmasi(false);
            }}
            disabled={sibuk}
            className="min-h-[48px] flex-1 rounded-xl bg-red-50 px-4 text-sm font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-50"
          >
            Tolak
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Alasan penolakan (wajib)</span>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={2}
              placeholder="mis. nominal tidak sesuai / bukti tidak jelas"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => kirim("REJECT")}
              disabled={sibuk}
              className="min-h-[48px] flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {sibuk ? "Memproses..." : "Tolak Pembayaran"}
            </button>
            <button
              onClick={() => {
                setModeTolak(false);
                setAlasan("");
                setGalat("");
              }}
              className="min-h-[48px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
