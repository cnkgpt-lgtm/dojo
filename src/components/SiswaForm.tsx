"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FotoUpload } from "./FotoUpload";
import { keTanggalInput, LABEL_STATUS_SISWA, LABEL_GENDER } from "@/lib/format";

export type SiswaAwal = {
  nama: string;
  foto?: string | null;
  phone?: string | null;
  email?: string | null;
  alamat?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: string | Date | null;
  jenisKelamin?: string | null;
  namaOrangTua?: string | null;
  phoneOrangTua?: string | null;
  dojoId?: string | null;
  tanggalBergabung?: string | Date | null;
  status?: string;
  sabukId?: string | null;
  catatan?: string | null;
};

const inputCls =
  "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400";
const labelCls = "block text-sm font-semibold text-slate-700";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={labelCls}>
      {label}
      {children}
    </label>
  );
}

/** Form tambah/ubah siswa. Semua field §8 PRD. */
export function SiswaForm({
  mode,
  studentId,
  awal,
  dojoList,
  sabukList,
}: {
  mode: "tambah" | "ubah";
  studentId?: string;
  awal?: SiswaAwal;
  dojoList: { id: string; nama: string }[];
  sabukList: { id: string; nama: string }[];
}) {
  const router = useRouter();
  const [foto, setFoto] = useState<string | null>(awal?.foto ?? null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");

  const kosong = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat("");
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      nama: String(fd.get("nama") ?? "").trim(),
      foto,
      phone: kosong(fd.get("phone")),
      email: kosong(fd.get("email")),
      alamat: kosong(fd.get("alamat")),
      tempatLahir: kosong(fd.get("tempatLahir")),
      tanggalLahir: kosong(fd.get("tanggalLahir")),
      jenisKelamin: kosong(fd.get("jenisKelamin")),
      namaOrangTua: kosong(fd.get("namaOrangTua")),
      phoneOrangTua: kosong(fd.get("phoneOrangTua")),
      dojoId: String(fd.get("dojoId") ?? ""),
      tanggalBergabung: kosong(fd.get("tanggalBergabung")),
      status: String(fd.get("status") ?? "AKTIF"),
      sabukId: kosong(fd.get("sabukId")),
      catatan: kosong(fd.get("catatan")),
    };
    try {
      const url = mode === "tambah" ? "/api/siswa" : `/api/siswa/${studentId}`;
      const res = await fetch(url, {
        method: mode === "tambah" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan data siswa.");
      router.push(mode === "tambah" ? "/dashboard/siswa" : `/dashboard/siswa/${studentId}`);
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan data siswa.");
      setMenyimpan(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-8">
      {galat && (
        <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200" role="alert">
          {galat}
        </p>
      )}

      <section aria-label="Data pribadi">
        <h2 className="mb-4 text-base font-bold">Data Pribadi</h2>
        <div className="mb-5">
          <span className={`${labelCls} mb-2 block`}>Foto</span>
          <FotoUpload tipe="siswa" nilaiAwal={foto} onBerhasil={setFoto} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap *">
            <input name="nama" required defaultValue={awal?.nama ?? ""} placeholder="Nama lengkap siswa" className={inputCls} />
          </Field>
          <Field label="Jenis kelamin">
            <select name="jenisKelamin" defaultValue={awal?.jenisKelamin ?? ""} className={inputCls}>
              <option value="">Pilih</option>
              {Object.entries(LABEL_GENDER).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Nomor HP">
            <input name="phone" inputMode="tel" defaultValue={awal?.phone ?? ""} placeholder="08xxxxxxxxxx" className={inputCls} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={awal?.email ?? ""} placeholder="nama@email.com" className={inputCls} />
          </Field>
          <Field label="Tempat lahir">
            <input name="tempatLahir" defaultValue={awal?.tempatLahir ?? ""} className={inputCls} />
          </Field>
          <Field label="Tanggal lahir">
            <input name="tanggalLahir" type="date" defaultValue={keTanggalInput(awal?.tanggalLahir)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat">
              <textarea name="alamat" rows={2} defaultValue={awal?.alamat ?? ""} className={inputCls} />
            </Field>
          </div>
        </div>
      </section>

      <section aria-label="Data orang tua atau wali">
        <h2 className="mb-4 text-base font-bold">Orang Tua / Wali</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama orang tua / wali">
            <input name="namaOrangTua" defaultValue={awal?.namaOrangTua ?? ""} className={inputCls} />
          </Field>
          <Field label="Nomor HP orang tua / wali">
            <input name="phoneOrangTua" inputMode="tel" defaultValue={awal?.phoneOrangTua ?? ""} placeholder="08xxxxxxxxxx" className={inputCls} />
          </Field>
        </div>
      </section>

      <section aria-label="Data keanggotaan">
        <h2 className="mb-4 text-base font-bold">Keanggotaan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Dojo *">
            <select name="dojoId" required defaultValue={awal?.dojoId ?? ""} className={inputCls}>
              <option value="">Pilih dojo</option>
              {dojoList.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal bergabung">
            <input name="tanggalBergabung" type="date" defaultValue={keTanggalInput(awal?.tanggalBergabung) || keTanggalInput(new Date())} className={inputCls} />
          </Field>
          <Field label="Sabuk saat ini">
            <select name="sabukId" defaultValue={awal?.sabukId ?? ""} className={inputCls}>
              <option value="">Belum ada</option>
              {sabukList.map((s) => (
                <option key={s.id} value={s.id}>{s.nama}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={awal?.status ?? "AKTIF"} className={inputCls}>
              {Object.entries(LABEL_STATUS_SISWA).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Catatan">
              <textarea name="catatan" rows={3} defaultValue={awal?.catatan ?? ""} placeholder="Catatan tambahan tentang siswa" className={inputCls} />
            </Field>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={menyimpan}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-dojo-700 px-6 text-sm font-semibold text-white disabled:opacity-50"
        >
          {menyimpan ? "Menyimpan..." : mode === "tambah" ? "Tambah Siswa" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
