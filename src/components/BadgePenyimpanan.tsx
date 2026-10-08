"use client";

import { useEffect, useState } from "react";

type Status = { telegram: boolean; aktif: "TELEGRAM" | "DATABASE" } | null;

/**
 * Badge status penyimpanan file: hijau "Terhubung" bila bot Telegram
 * tersambung, kuning "Sementara" + saran bila masih penyimpanan lokal.
 */
export function BadgePenyimpanan({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    let batal = false;
    fetch("/api/storage/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!batal && j && typeof j.telegram === "boolean") setStatus(j);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, []);

  if (!status) return null;

  if (status.telegram) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 ${className}`}
        title="File bukti & selfie tersimpan permanen di Telegram"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
        Penyimpanan: Terhubung
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
        Penyimpanan: Sementara
      </span>
      <span className="text-xs text-slate-500">
        File tersimpan sementara di server. Sambungkan Telegram agar tersimpan permanen.
      </span>
    </span>
  );
}
