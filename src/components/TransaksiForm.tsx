"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opsi = { id: string; nama: string };

const inputCls = "mt-1 brutal-input";
const labelCls = "block text-sm font-semibold";

export type TransaksiAwal = {
  tanggal?: string;
  kategoriId?: string;
  deskripsi?: string;
  nominal?: number;
  metode?: string;
  dojoId?: string;
  catatan?: string | null;
  buktiUrl?: string | null;
};

/**
 * Form tambah/ubah pemasukan & pengeluaran (§27, §28).
 * Mengirim multipart agar bukti bisa diupload sekaligus.
 */
export function TransaksiForm({
  jenis,
  mode,
  transaksiId,
  awal,
  dojoList,
  kategoriList,
  dojoTerkunci,
}: {
  jenis: "pemasukan" | "pengeluaran";
  mode: "tambah" | "ubah";
  transaksiId?: string;
  awal: TransaksiAwal;
  dojoList: Opsi[];
  kategoriList: Opsi[];
  /** Bila admin dojo: dojo terkunci, tanpa pilihan. */
  dojoTerkunci: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    tanggal: awal.tanggal ?? "",
    kategoriId: awal.kategoriId ?? "",
    deskripsi: awal.deskripsi ?? "",
    nominal: awal.nominal != null ? String(awal.nominal) : "",
    metode: awal.metode ?? "TUNAI",
    dojoId: awal.dojoId ?? dojoTerkunci ?? "",
    catatan: awal.catatan ?? "",
  });
  const [bukti, setBukti] = useState<File | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  function ubah<K extends keyof typeof form>(kunci: K, nilai: (typeof form)[K]) {
    setForm((f) => ({ ...f, [kunci]: nilai }));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat("");
    try {
      const fd = new FormData();
      fd.set("tanggal", form.tanggal);
      fd.set("kategoriId", form.kategoriId);
      fd.set("deskripsi", form.deskripsi.trim());
      fd.set("nominal", form.nominal);
      fd.set("dojoId", form.dojoId);
      if (jenis === "pemasukan") fd.set("metode", form.metode);
      if (jenis === "pengeluaran") fd.set("catatan", form.catatan.trim());
      if (bukti) fd.set("bukti", bukti);

      const res = await fetch(
        mode === "tambah" ? `/api/${jenis}` : `/api/${jenis}/${transaksiId}`,
        { method: mode === "tambah" ? "POST" : "PATCH", body: fd }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan data.");
      router.push(`/dashboard/keuangan/${jenis}`);
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan data.");
      setMenyimpan(false);
    }
  }

  const judul = jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran";

  return (
    <form onSubmit={simpan} className="brutal-card space-y-5 bg-slate-50 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="tanggal" className={labelCls}>Tanggal</label>
          <input
            id="tanggal" type="date" required value={form.tanggal}
            onChange={(e) => ubah("tanggal", e.target.value)} className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="kategoriId" className={labelCls}>Kategori</label>
          <select
            id="kategoriId" required value={form.kategoriId}
            onChange={(e) => ubah("kategoriId", e.target.value)} className={inputCls}
          >
            <option value="">Pilih kategori</option>
            {kategoriList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="deskripsi" className={labelCls}>Deskripsi</label>
        <input
          id="deskripsi" required minLength={3} maxLength={300} value={form.deskripsi}
          onChange={(e) => ubah("deskripsi", e.target.value)} className={inputCls}
          placeholder={jenis === "pemasukan" ? "cth. Pendaftaran siswa baru" : "cth. Sewa matras dojo"}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nominal" className={labelCls}>Nominal (Rp)</label>
          <input
            id="nominal" type="number" required min={1000} step={500} value={form.nominal}
            onChange={(e) => ubah("nominal", e.target.value)} className={inputCls}
            placeholder="100000"
          />
        </div>
        {jenis === "pemasukan" && (
          <div>
            <label htmlFor="metode" className={labelCls}>Metode pembayaran</label>
            <select
              id="metode" value={form.metode}
              onChange={(e) => ubah("metode", e.target.value)} className={inputCls}
            >
              <option value="TUNAI">Tunai</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="dojoId" className={labelCls}>Dojo</label>
        {dojoTerkunci ? (
          <p className="brutal-input mt-1 text-sm">
            {dojoList.find((d) => d.id === dojoTerkunci)?.nama ?? "-"}
          </p>
        ) : (
          <select
            id="dojoId" required value={form.dojoId}
            onChange={(e) => ubah("dojoId", e.target.value)} className={inputCls}
          >
            <option value="">Pilih dojo</option>
            {dojoList.map((d) => (
              <option key={d.id} value={d.id}>{d.nama}</option>
            ))}
          </select>
        )}
      </div>

      {jenis === "pengeluaran" && (
        <div>
          <label htmlFor="catatan" className={labelCls}>Catatan (opsional)</label>
          <textarea
            id="catatan" rows={2} maxLength={500} value={form.catatan}
            onChange={(e) => ubah("catatan", e.target.value)} className={inputCls}
            placeholder="Keterangan tambahan"
          />
        </div>
      )}

      <div>
        <label htmlFor="bukti" className={labelCls}>Bukti (opsional, JPG/PNG/WebP maks 2MB)</label>
        <input
          id="bukti" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setBukti(e.target.files?.[0] ?? null)} className={inputCls}
        />
        {mode === "ubah" && awal.buktiUrl && !bukti && (
          <p className="mt-1 text-xs text-slate-500">
            Bukti saat ini: <a href={awal.buktiUrl} target="_blank" rel="noreferrer" className="font-semibold text-dojo-700 underline">lihat</a> (upload baru untuk mengganti)
          </p>
        )}
      </div>

      {galat && <p role="alert" className="brutal-card bg-red-50 px-4 py-3 text-sm text-red-700">{galat}</p>}

      <button
        type="submit" disabled={menyimpan}
        className="brutal-btn brutal-btn-primary w-full text-base"
      >
        {menyimpan ? "Menyimpan..." : mode === "tambah" ? `Simpan ${judul}` : `Simpan Perubahan`}
      </button>
    </form>
  );
}
