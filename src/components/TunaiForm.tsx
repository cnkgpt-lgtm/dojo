"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah} from "@/lib/format";
import { labelPeriode } from "@/lib/iuran";

type TagihanOpt = {
  id: string;
  periode: string;
  nominal: number;
  student: { nama: string; memberId: string };
};

/** Form catat pembayaran tunai oleh admin (§21): nominal harus pas sisa tagihan. */
export function TunaiForm({ tagihanList }: { tagihanList: TagihanOpt[] }) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [sukses, setSukses] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);

  const dipilih = tagihanList.find((t) => t.id === invoiceId) ?? null;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    setSukses("");
    if (!dipilih) {
      setGalat("Pilih tagihan terlebih dahulu.");
      return;
    }
    // Konfirmasi inline dua langkah (bukan dialog confirm() bawaan browser).
    if (!konfirmasi) {
      setKonfirmasi(true);
      return;
    }
    setSibuk(true);
    const r = await fetch("/api/pembayaran/tunai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId,
        nominal: dipilih.nominal,
        tanggal: tanggal || null,
        catatan: catatan.trim() || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setSibuk(false);
    if (!r.ok) {
      setGalat(j.error ?? "Gagal mencatat pembayaran.");
      return;
    }
    setSukses(`Pembayaran tunai ${rupiah(dipilih.nominal)} tercatat. Tagihan LUNAS.`);
    setKonfirmasi(false);
    setInvoiceId("");
    setTanggal("");
    setCatatan("");
    router.refresh();
  }

  const inputCls = "brutal-input";

  return (
    <form onSubmit={simpan} className="brutal-card bg-slate-50 p-5">
      <h2 className="brutal-title text-lg">CATAT PEMBAYARAN TUNAI</h2>
      <p className="mt-1 text-xs text-slate-500">
        Status tagihan langsung menjadi LUNAS dan tercatat sebagai pemasukan.
      </p>
      {galat && (
        <p className="brutal-card mt-3 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {galat}
        </p>
      )}
      {sukses && (
        <p className="brutal-card mt-3 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {sukses}
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Tagihan</span>
          <select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">— Pilih tagihan belum bayar —</option>
            {tagihanList.map((t) => (
              <option key={t.id} value={t.id}>
                {t.student.nama} ({t.student.memberId}) · {labelPeriode(t.periode)} · {rupiah(t.nominal)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Tanggal bayar</span>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Catatan (opsional)</span>
          <input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. dibayar di dojo"
            maxLength={500}
            className={inputCls}
          />
        </label>
      </div>
      {dipilih && (
        <p className="mt-3 text-sm font-semibold">
          Nominal: <span className="brutal-angka">{rupiah(dipilih.nominal)}</span>{" "}
          <span className="font-normal text-slate-500">(harus pas)</span>
        </p>
      )}
      <button
        type="submit"
        disabled={sibuk || !dipilih}
        className={`brutal-btn mt-4 ${konfirmasi ? "brutal-btn-warn" : "brutal-btn-primary"}`}
      >
        {sibuk ? "Menyimpan..." : konfirmasi ? "Yakin, Catat Tunai" : "Catat Tunai"}
      </button>
    </form>
  );
}
