"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah} from "@/lib/format";
import { labelPeriode } from "@/lib/iuran";

type Tagihan = {
  id: string;
  periode: string;
  nominal: number;
  statusTampilan: string;
};

/** Form pembayaran transfer oleh siswa: nominal + tanggal + upload bukti wajib (§22, §54). */
export function BayarForm({ tagihan }: { tagihan: Tagihan }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [tanggal, setTanggal] = useState("");
  const [bukti, setBukti] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    if (!tanggal) {
      setGalat("Tanggal transfer wajib diisi.");
      return;
    }
    if (!bukti) {
      setGalat("Bukti transfer wajib diupload.");
      return;
    }
    if (!confirm(`Kirim pembayaran ${rupiah(tagihan.nominal)} untuk iuran ${labelPeriode(tagihan.periode)}?`))
      return;
    setSibuk(true);
    const form = new FormData();
    form.append("invoiceId", tagihan.id);
    form.append("nominal", String(tagihan.nominal));
    form.append("tanggal", tanggal);
    form.append("bukti", bukti);
    const r = await fetch("/api/pembayaran/transfer", { method: "POST", body: form });
    const j = await r.json().catch(() => ({}));
    setSibuk(false);
    if (!r.ok) {
      setGalat(j.error ?? "Gagal mengirim pembayaran.");
      return;
    }
    setBuka(false);
    router.refresh();
  }

  const inputCls =
    "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100";

  return (
    <div className="mt-3">
      {!buka ? (
        <button
          onClick={() => setBuka(true)}
          className="min-h-[48px] w-full rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white sm:w-auto"
        >
          BAYAR
        </button>
      ) : (
        <form onSubmit={kirim} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          {galat && (
            <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {galat}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Nominal (Rp)</span>
              <input value={rupiah(tagihan.nominal)} disabled className={`${inputCls} bg-slate-100`} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Tanggal transfer</span>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={inputCls}
                required
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-semibold">Bukti transfer (JPG/PNG/WebP, maks 2MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setBukti(e.target.files?.[0] ?? null)}
                className="w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:py-2.5 file:text-sm file:font-semibold"
                required
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={sibuk}
              className="min-h-[48px] flex-1 rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
            >
              {sibuk ? "Mengirim..." : "KIRIM PEMBAYARAN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBuka(false);
                setGalat("");
              }}
              className="min-h-[48px] rounded-xl bg-slate-200 px-5 text-sm font-semibold text-slate-700"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
