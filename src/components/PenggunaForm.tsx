"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Dojo = { id: string; nama: string };

const inputCls =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100";

/** Form tambah pengguna: nama + HP + sandi + pilih role (Admin/Sensei/Siswa). */
export function PenggunaForm({ dojoList }: { dojoList: Dojo[] }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("SISWA");
  const [dojoId, setDojoId] = useState("");
  const [scopeDojoId, setScopeDojoId] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [sukses, setSukses] = useState("");

  const perluDojo = role === "SENSEI" || role === "SISWA";

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    setSukses("");
    setSibuk(true);
    try {
      const r = await fetch("/api/pengguna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama,
          phone,
          email: email || null,
          password,
          role,
          dojoId: perluDojo ? dojoId || null : null,
          scopeDojoId: role === "ADMIN" ? scopeDojoId || null : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setGalat(j.error ?? "Gagal menambah pengguna.");
        return;
      }
      setSukses(j.pesan ?? "Akun pengguna berhasil dibuat.");
      setNama("");
      setPhone("");
      setEmail("");
      setPassword("");
      setDojoId("");
      setScopeDojoId("");
      router.refresh();
    } catch {
      setGalat("Terjadi kesalahan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:p-5">
      {!buka ? (
        <button
          onClick={() => setBuka(true)}
          className="min-h-[48px] w-full rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white sm:w-auto"
        >
          + Tambah Pengguna
        </button>
      ) : (
        <form onSubmit={kirim}>
          <p className="mb-3 text-sm font-bold">Pengguna baru</p>
          {galat && (
            <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {galat}
            </p>
          )}
          {sukses && (
            <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
              {sukses}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Nama lengkap</span>
              <input value={nama} onChange={(e) => setNama(e.target.value)} required minLength={3} className={inputCls} placeholder="Nama pengguna" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Nomor HP (untuk login)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={9} maxLength={16} inputMode="tel" className={inputCls} placeholder="08xxxxxxxxxx" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Email (opsional)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="nama@email.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Kata sandi awal</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputCls} placeholder="Min. 6 karakter" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} bg-white`}>
                <option value="SISWA">Siswa — bisa absen & bayar iuran</option>
                <option value="SENSEI">Sensei — kelola latihan & nilai</option>
                <option value="ADMIN">Admin — akses penuh</option>
              </select>
            </label>
            {perluDojo ? (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Dojo</span>
                <select value={dojoId} onChange={(e) => setDojoId(e.target.value)} required className={`${inputCls} bg-white`}>
                  <option value="">— Pilih dojo —</option>
                  {dojoList.map((d) => (
                    <option key={d.id} value={d.id}>{d.nama}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Batasi ke dojo (opsional)</span>
                <select value={scopeDojoId} onChange={(e) => setScopeDojoId(e.target.value)} className={`${inputCls} bg-white`}>
                  <option value="">Semua dojo (admin pusat)</option>
                  {dojoList.map((d) => (
                    <option key={d.id} value={d.id}>{d.nama}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {role === "SISWA" && "Otomatis dibuatkan profil siswa + Member ID (KRT-XXXXXX)."}
            {role === "SENSEI" && "Otomatis dibuatkan profil sensei di dojo terpilih."}
            {role === "ADMIN" && "Akun admin dibuat tanpa profil tambahan."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={sibuk}
              className="min-h-[48px] flex-1 rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
            >
              {sibuk ? "Menyimpan..." : "Simpan Pengguna"}
            </button>
            <button
              type="button"
              onClick={() => { setBuka(false); setGalat(""); setSukses(""); }}
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
