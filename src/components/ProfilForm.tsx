"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FotoUpload } from "./FotoUpload";

const inputCls = "brutal-input mt-1 block";
const labelCls = "block text-sm font-semibold text-slate-700";

export type ProfilAwal = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  foto?: string | null;
  alamat?: string | null;
};

/** Form ubah profil sendiri. Hanya field aman; role/dojo/status tidak tersentuh. */
export function ProfilForm({ awal, isAdmin }: { awal: ProfilAwal; isAdmin: boolean }) {
  const router = useRouter();
  const [foto, setFoto] = useState<string | null>(awal.foto ?? null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState("");
  const [berhasil, setBerhasil] = useState("");

  const kosong = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };

  async function simpan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMenyimpan(true);
    setGalat("");
    setBerhasil("");
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = isAdmin
      ? {
          name: String(fd.get("name") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
          email: kosong(fd.get("email")),
        }
      : {
          foto,
          phone: kosong(fd.get("phone")),
          email: kosong(fd.get("email")),
          alamat: kosong(fd.get("alamat")),
        };
    try {
      const res = await fetch("/api/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan profil.");
      setBerhasil("Profil berhasil disimpan.");
      router.refresh();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan profil.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <form onSubmit={simpan} className="space-y-5">
      {galat && (
        <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200" role="alert">
          {galat}
        </p>
      )}
      {berhasil && (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200" role="status">
          {berhasil}
        </p>
      )}

      {!isAdmin && (
        <div>
          <span className={`${labelCls} mb-2 block`}>Foto</span>
          <FotoUpload tipe="profil" nilaiAwal={foto} onBerhasil={setFoto} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isAdmin ? (
          <>
            <label className={labelCls}>
              Nama *
              <input name="name" required defaultValue={awal.name ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              Nomor HP *
              <input name="phone" required inputMode="tel" defaultValue={awal.phone ?? ""} className={inputCls} />
            </label>
            <label className={labelCls}>
              Email
              <input name="email" type="email" defaultValue={awal.email ?? ""} className={inputCls} />
            </label>
          </>
        ) : (
          <>
            <label className={labelCls}>
              Nomor HP
              <input name="phone" inputMode="tel" defaultValue={awal.phone ?? ""} placeholder="08xxxxxxxxxx" className={inputCls} />
            </label>
            <label className={labelCls}>
              Email
              <input name="email" type="email" defaultValue={awal.email ?? ""} placeholder="nama@email.com" className={inputCls} />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              Alamat
              <textarea name="alamat" rows={2} defaultValue={awal.alamat ?? ""} className={inputCls} />
            </label>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={menyimpan}
        className="brutal-btn brutal-btn-primary"
      >
        {menyimpan ? "Menyimpan..." : "Simpan Profil"}
      </button>
    </form>
  );
}
