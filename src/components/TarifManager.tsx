"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rupiah } from "@/lib/format";

type Tarif = {
  id: string;
  nama: string;
  nominal: number;
  hariJatuhTempo: number;
  isActive: boolean;
  dojo: { id: string; nama: string } | null;
  student: { id: string; nama: string; memberId: string } | null;
};

type DojoOpt = { id: string; nama: string };
type SiswaOpt = { id: string; nama: string; memberId: string; dojo: { nama: string } };

function cakupanLabel(t: Tarif): string {
  if (t.student) return `${t.student.nama} (${t.student.memberId})`;
  if (t.dojo) return `Dojo ${t.dojo.nama}`;
  return "Default organisasi";
}

const awalForm = { nama: "", nominal: "", hariJatuhTempo: "10", dojoId: "", studentId: "" };

export function TarifManager({
  tarifAwal,
  dojoList,
  siswaList,
}: {
  tarifAwal: Tarif[];
  dojoList: DojoOpt[];
  siswaList: SiswaOpt[];
}) {
  const router = useRouter();
  const [daftar, setDaftar] = useState<Tarif[]>(tarifAwal);
  const [form, setForm] = useState(awalForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [konfirmasiId, setKonfirmasiId] = useState<string | null>(null);

  async function muatUlang() {
    const r = await fetch("/api/tarif");
    const j = await r.json();
    if (r.ok) setDaftar(j.data);
    router.refresh();
  }

  function isiFormEdit(t: Tarif) {
    setEditId(t.id);
    setForm({
      nama: t.nama,
      nominal: String(t.nominal),
      hariJatuhTempo: String(t.hariJatuhTempo),
      dojoId: t.dojo?.id ?? "",
      studentId: t.student?.id ?? "",
    });
    setGalat("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function batal() {
    setEditId(null);
    setForm(awalForm);
    setGalat("");
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setGalat("");
    const payload = {
      nama: form.nama.trim(),
      nominal: Number(form.nominal),
      hariJatuhTempo: Number(form.hariJatuhTempo),
      dojoId: form.dojoId || null,
      studentId: form.studentId || null,
    };
    const r = await fetch(editId ? `/api/tarif/${editId}` : "/api/tarif", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    setSibuk(false);
    if (!r.ok) {
      setGalat(j.error ?? "Gagal menyimpan tarif.");
      return;
    }
    batal();
    await muatUlang();
  }

  async function toggleAktif(t: Tarif) {
    setSibuk(true);
    const r = await fetch(`/api/tarif/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    setSibuk(false);
    if (r.ok) await muatUlang();
  }

  async function hapus(t: Tarif) {
    // Konfirmasi inline dua langkah per baris (bukan dialog confirm() bawaan).
    if (konfirmasiId !== t.id) {
      setKonfirmasiId(t.id);
      return;
    }
    setKonfirmasiId(null);
    const r = await fetch(`/api/tarif/${t.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setGalat(j.error ?? "Gagal menghapus tarif.");
      return;
    }
    await muatUlang();
  }

  const inputCls =
    "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-dojo-600 focus:outline-none focus:ring-2 focus:ring-dojo-100";

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={simpan} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
        <h2 className="text-base font-bold">{editId ? "Ubah Tarif" : "Tambah Tarif"}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pilih cakupan: siswa spesifik, atau satu dojo, atau kosongkan keduanya untuk tarif default organisasi.
        </p>
        {galat && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
            {galat}
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold">Nama tarif</span>
            <input
              className={inputCls}
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Iuran Bulanan Reguler"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nominal (Rp)</span>
            <input
              type="number"
              min={1000}
              step={1000}
              className={inputCls}
              value={form.nominal}
              onChange={(e) => setForm({ ...form, nominal: e.target.value })}
              placeholder="100000"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Jatuh tempo tiap tanggal</span>
            <input
              type="number"
              min={1}
              max={28}
              className={inputCls}
              value={form.hariJatuhTempo}
              onChange={(e) => setForm({ ...form, hariJatuhTempo: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Dojo (opsional)</span>
            <select
              className={inputCls}
              value={form.dojoId}
              onChange={(e) => setForm({ ...form, dojoId: e.target.value, studentId: "" })}
            >
              <option value="">— Default organisasi —</option>
              {dojoList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Siswa spesifik (opsional)</span>
            <select
              className={inputCls}
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value, dojoId: "" })}
            >
              <option value="">— Tidak spesifik —</option>
              {siswaList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama} ({s.memberId}) · {s.dojo.nama}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={sibuk}
            className="min-h-[48px] rounded-xl bg-dojo-700 px-6 text-sm font-bold text-white disabled:opacity-50"
          >
            {sibuk ? "Menyimpan..." : editId ? "Simpan Perubahan" : "Tambah Tarif"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={batal}
              className="min-h-[48px] rounded-xl bg-slate-200 px-6 text-sm font-bold text-slate-700"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {/* Daftar */}
      <div className="space-y-3">
        {daftar.length === 0 && (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            Belum ada tarif. Tambahkan tarif default organisasi terlebih dahulu.
          </p>
        )}
        {daftar.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl p-4 ring-1 sm:flex sm:items-center sm:justify-between ${
              t.isActive ? "bg-white ring-slate-200" : "bg-slate-50 ring-slate-200 opacity-70"
            }`}
          >
            <div>
              <p className="font-bold">
                {t.nama}{" "}
                {!t.isActive && (
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    Nonaktif
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {rupiah(t.nominal)}/bulan · jatuh tempo tgl {t.hariJatuhTempo} · {cakupanLabel(t)}
              </p>
            </div>
            <div className="mt-3 flex gap-2 sm:mt-0">
              <button
                onClick={() => isiFormEdit(t)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
              >
                Ubah
              </button>
              <button
                onClick={() => toggleAktif(t)}
                disabled={sibuk}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700"
              >
                {t.isActive ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button
                onClick={() => hapus(t)}
                className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${
                  konfirmasiId === t.id
                    ? "bg-amber-600 text-white"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {konfirmasiId === t.id ? "Yakin hapus?" : "Hapus"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
