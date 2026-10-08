"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FotoUpload } from "./FotoUpload";

export type SenseiAwal = {
  nama: string;
  foto?: string | null;
  dojoId?: string | null;
  phone?: string | null;
  email?: string | null;
  alamat?: string | null;
  nomorIdentitas?: string | null;
  spesialisasi?: string | null;
  isActive?: boolean;
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

/** Form tambah/ubah sensei. Semua field §11 PRD. */
export function SenseiForm({
  mode,
  coachId,
  awal,
  dojoList,
}: {
  mode: "tambah" | "ubah";
  coachId?: string;
  awal?: SenseiAwal;
  dojoList: { id: string; nama: string }[];
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
      dojoId: kosong(fd.get("dojoId")),
      phone: kosong(fd.get("phone")),
      email: kosong(fd.get("email")),
      alamat: kosong(fd.get("alamat")),
      nomorIdentitas: kosong(fd.get("nomorIdentitas")),
      spesialisasi: kosong(fd.get("spesialisasi")),
      isActive: fd.get("isActive") === "on",
    };
    try {
      const url = mode === "tambah" ? "/api/sensei" : `/api/sensei/${coachId}`;
      const res = await fetch(url, {
        method: mode === "tambah" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan data sensei.");
      router.push(mode === "tambah" ? "/dashboard/sensei" : `/dashboard/sensei/${coachId}`);
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan data sensei.");
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

      <section aria-label="Data sensei">
        <div className="mb-5">
          <span className={`${labelCls} mb-2 block`}>Foto</span>
          <FotoUpload tipe="sensei" nilaiAwal={foto} onBerhasil={setFoto} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nama *">
            <input name="nama" required defaultValue={awal?.nama ?? ""} placeholder="Nama sensei" className={inputCls} />
          </Field>
          <Field label="Nomor identitas / member">
            <input name="nomorIdentitas" defaultValue={awal?.nomorIdentitas ?? ""} placeholder="Nomor identitas" className={inputCls} />
          </Field>
          <Field label="Dojo">
            <select name="dojoId" defaultValue={awal?.dojoId ?? ""} className={inputCls}>
              <option value="">Tanpa dojo tetap</option>
              {dojoList.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </Field>
          <Field label="Spesialisasi">
            <input name="spesialisasi" defaultValue={awal?.spesialisasi ?? ""} placeholder="Mis. Kata, Kumite" className={inputCls} />
          </Field>
          <Field label="Nomor HP">
            <input name="phone" inputMode="tel" defaultValue={awal?.phone ?? ""} placeholder="08xxxxxxxxxx" className={inputCls} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={awal?.email ?? ""} placeholder="nama@email.com" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat">
              <textarea name="alamat" rows={2} defaultValue={awal?.alamat ?? ""} className={inputCls} />
            </Field>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={awal?.isActive ?? true}
              className="h-5 w-5 rounded accent-red-700"
            />
            Sensei aktif
          </label>
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
          {menyimpan ? "Menyimpan..." : mode === "tambah" ? "Tambah Sensei" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
