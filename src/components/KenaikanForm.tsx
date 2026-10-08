"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Siswa = {
  id: string;
  nama: string;
  memberId: string;
  sabuk: { nama: string; urutan: number } | null;
};

type Sabuk = { id: string; nama: string; urutan: number; isActive: boolean };

export function KenaikanForm({ siswaList, sabukList }: { siswaList: Siswa[]; sabukList: Sabuk[] }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [beltBaruId, setBeltBaruId] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [nilai, setNilai] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const siswa = siswaList.find((s) => s.id === studentId);
  const beltBaru = sabukList.find((b) => b.id === beltBaruId);
  const pilihan = sabukList.filter(
    (b) => b.isActive && (!siswa?.sabuk || b.urutan > siswa.sabuk.urutan)
  );

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setPesan(null);
    try {
      const form = new FormData();
      form.set("beltBaruId", beltBaruId);
      form.set("tanggal", tanggal);
      if (nilai.trim()) form.set("nilai", nilai.trim());
      if (keterangan.trim()) form.set("keterangan", keterangan.trim());
      if (foto) form.set("foto", foto);

      const res = await fetch(`/api/siswa/${studentId}/kenaikan-sabuk`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mencatat kenaikan.");
      setPesan(
        `Berhasil: ${siswa?.nama} naik ke sabuk ${beltBaru?.nama}.`
      );
      setStudentId("");
      setBeltBaruId("");
      setNilai("");
      setKeterangan("");
      setFoto(null);
      router.refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : "Gagal mencatat kenaikan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form
      onSubmit={kirim}
      className="brutal-card p-5"
    >
      {pesan && (
        <p className="brutal-card mb-4 px-4 py-3 text-sm font-medium text-slate-700">
          {pesan}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Siswa</span>
          <select
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setBeltBaruId("");
            }}
            required
            className="brutal-input mt-1"
          >
            <option value="">— Pilih siswa —</option>
            {siswaList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.memberId}) — Sabuk: {s.sabuk?.nama ?? "belum ada"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Sabuk baru</span>
          <select
            value={beltBaruId}
            onChange={(e) => setBeltBaruId(e.target.value)}
            required
            disabled={!siswa}
            className="brutal-input mt-1"
          >
            <option value="">— Pilih sabuk —</option>
            {pilihan.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nama} (tingkat {b.urutan})
              </option>
            ))}
          </select>
          {siswa && pilihan.length === 0 && (
            <span className="mt-1 block text-xs text-slate-500">
              Siswa sudah di tingkat tertinggi.
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-sm font-medium">Tanggal kenaikan</span>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            required
            className="brutal-input mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Nilai (opsional)</span>
          <input
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
            placeholder="mis. 85 atau Lulus"
            maxLength={50}
            className="brutal-input mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Foto dokumentasi (opsional)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="brutal-input mt-1 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium">Keterangan</span>
          <textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            rows={3}
            placeholder="Wajib diisi bila naik lebih dari satu tingkat"
            className="brutal-input mt-1"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={sibuk || !studentId || !beltBaruId}
        className="brutal-btn brutal-btn-primary mt-4"
      >
        {sibuk ? "Menyimpan…" : "Catat Kenaikan Sabuk"}
      </button>
    </form>
  );
}
