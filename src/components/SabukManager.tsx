"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Sabuk = {
  id: string;
  nama: string;
  urutan: number;
  warnaHex: string | null;
  deskripsi: string | null;
  isActive: boolean;
};

const WARNA_BAWAAN = ["#f8fafc", "#eab308", "#16a34a", "#2563eb", "#92400e", "#111827"];

export function SabukManager({ sabukAwal }: { sabukAwal: Sabuk[] }) {
  const router = useRouter();
  const [daftar, setDaftar] = useState<Sabuk[]>(sabukAwal);
  const [form, setForm] = useState({ nama: "", urutan: "", warnaHex: "#111827", deskripsi: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setPesan(null);
    try {
      const res = await fetch(editId ? `/api/sabuk/${editId}` : "/api/sabuk", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: form.nama.toUpperCase(),
          urutan: Number(form.urutan),
          warnaHex: form.warnaHex,
          deskripsi: form.deskripsi || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan.");
      const baru: Sabuk = json.data;
      setDaftar((d) =>
        (editId ? d.map((x) => (x.id === editId ? baru : x)) : [...d, baru]).sort(
          (a, b) => a.urutan - b.urutan
        )
      );
      setForm({ nama: "", urutan: "", warnaHex: "#111827", deskripsi: "" });
      setEditId(null);
      setPesan(editId ? "Sabuk diperbarui." : "Sabuk ditambahkan.");
      router.refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(id: string, nama: string) {
    if (!confirm(`Hapus sabuk ${nama}?`)) return;
    setSibuk(true);
    setPesan(null);
    try {
      const res = await fetch(`/api/sabuk/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menghapus.");
      setDaftar((d) => d.filter((x) => x.id !== id));
      setPesan("Sabuk dihapus.");
      router.refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setSibuk(false);
    }
  }

  function mulaiUbah(s: Sabuk) {
    setEditId(s.id);
    setForm({
      nama: s.nama,
      urutan: String(s.urutan),
      warnaHex: s.warnaHex ?? "#111827",
      deskripsi: s.deskripsi ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      {pesan && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{pesan}</p>
      )}

      <form
        onSubmit={kirim}
        className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
      >
        <h2 className="font-bold">{editId ? "Ubah Sabuk" : "Tambah Sabuk"}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Nama</span>
            <input
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="PUTIH"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Urutan</span>
            <input
              type="number"
              min={1}
              value={form.urutan}
              onChange={(e) => setForm({ ...form, urutan: e.target.value })}
              placeholder="1"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Warna badge</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={form.warnaHex}
                onChange={(e) => setForm({ ...form, warnaHex: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300"
              />
              <span
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: form.warnaHex }}
              >
                {form.nama || "Contoh"}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {WARNA_BAWAAN.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setForm({ ...form, warnaHex: w })}
                  className="h-6 w-6 rounded-full ring-1 ring-slate-300"
                  style={{ backgroundColor: w }}
                  aria-label={`Warna ${w}`}
                />
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Deskripsi (opsional)</span>
            <input
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Tingkatan dasar"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={sibuk}
            className="rounded-xl bg-dojo-700 px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {sibuk ? "Menyimpan…" : editId ? "Simpan Perubahan" : "Tambah Sabuk"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setForm({ nama: "", urutan: "", warnaHex: "#111827", deskripsi: "" });
              }}
              className="rounded-xl px-5 py-2.5 font-semibold text-slate-600 ring-1 ring-slate-300"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Urutan</th>
              <th className="px-4 py-3">Sabuk</th>
              <th className="px-4 py-3">Deskripsi</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold">{s.urutan}</td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: s.warnaHex ?? "#64748b" }}
                  >
                    {s.nama}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.deskripsi ?? "–"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => mulaiUbah(s)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-dojo-700 ring-1 ring-dojo-700/30"
                    >
                      Ubah
                    </button>
                    <button
                      onClick={() => hapus(s.id, s.nama)}
                      disabled={sibuk}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {daftar.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Belum ada data sabuk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
