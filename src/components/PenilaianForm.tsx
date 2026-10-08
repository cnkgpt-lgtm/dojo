"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ASPEK = [
  { key: "kihon", label: "Kihon" },
  { key: "kata", label: "Kata" },
  { key: "kumite", label: "Kumite" },
  { key: "fisik", label: "Fisik" },
  { key: "disiplin", label: "Disiplin" },
  { key: "sikap", label: "Sikap" },
  { key: "kehadiran", label: "Kehadiran" },
  { key: "teknik", label: "Teknik" },
] as const;

type Siswa = { id: string; nama: string; memberId: string };

type NilaiEdit = {
  id: string;
  studentId: string;
  periode: string;
  catatan: string | null;
  kihon: number | null;
  kata: number | null;
  kumite: number | null;
  fisik: number | null;
  disiplin: number | null;
  sikap: number | null;
  kehadiran: number | null;
  teknik: number | null;
};

export function PenilaianForm({
  siswaList,
  skala,
  editAwal,
}: {
  siswaList: Siswa[];
  skala: "ANGKA" | "LABEL";
  editAwal?: NilaiEdit;
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(editAwal?.studentId ?? "");
  const [periode, setPeriode] = useState(
    editAwal?.periode ?? new Date().toISOString().slice(0, 7)
  );
  const [nilai, setNilai] = useState<Record<string, string>>(() => {
    const awal: Record<string, string> = {};
    for (const a of ASPEK) {
      const v = editAwal?.[a.key];
      awal[a.key] = typeof v === "number" ? String(v) : "";
    }
    return awal;
  });
  const [catatan, setCatatan] = useState(editAwal?.catatan ?? "");
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setSibuk(true);
    setPesan(null);
    try {
      const body: Record<string, unknown> = { studentId, periode };
      for (const a of ASPEK) {
        const v = nilai[a.key].trim();
        body[a.key] = v === "" ? null : Number(v);
      }
      body.catatan = catatan.trim() || null;

      const url = editAwal ? `/api/penilaian/${editAwal.id}` : "/api/penilaian";
      const res = await fetch(url, {
        method: editAwal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menyimpan penilaian.");
      setPesan(editAwal ? "Penilaian diperbarui." : "Penilaian tersimpan.");
      if (!editAwal) {
        setStudentId("");
        setNilai(Object.fromEntries(ASPEK.map((a) => [a.key, ""])));
        setCatatan("");
      }
      router.refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : "Gagal menyimpan penilaian.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      {pesan && (
        <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          {pesan}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Siswa</span>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            disabled={!!editAwal}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:opacity-60"
          >
            <option value="">— Pilih siswa —</option>
            {siswaList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} ({s.memberId})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Periode</span>
          <input
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            required
            disabled={!!editAwal}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:opacity-60"
          />
        </label>
      </div>

      <p className="mt-5 mb-2 text-sm font-bold">
        Aspek penilaian{" "}
        <span className="font-normal text-slate-500">
          (skala {skala === "LABEL" ? "label" : "1–5"}, boleh dikosongkan)
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ASPEK.map((a) => (
          <label key={a.key} className="block rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <span className="text-sm font-medium">{a.label}</span>
            <input
              type="number"
              min={1}
              max={5}
              value={nilai[a.key]}
              onChange={(e) => setNilai({ ...nilai, [a.key]: e.target.value })}
              placeholder="1–5"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-center text-lg font-bold"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Catatan sensei</span>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={3}
          placeholder="Catatan perkembangan siswa…"
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
        />
      </label>

      <button
        type="submit"
        disabled={sibuk || !studentId || !periode}
        className="mt-4 rounded-xl bg-dojo-700 px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {sibuk ? "Menyimpan…" : editAwal ? "Simpan Perubahan" : "Simpan Penilaian"}
      </button>
    </form>
  );
}
