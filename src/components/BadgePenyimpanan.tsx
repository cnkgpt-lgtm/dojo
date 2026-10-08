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
        className={`brutal-badge inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 ${className}`}
        title="File bukti & selfie tersimpan permanen di Telegram"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
        Penyimpanan: Terhubung
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <span className="brutal-badge inline-flex w-fit items-center gap-1.5 bg-amber-100 text-amber-900">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
        Penyimpanan: Sementara
      </span>
      <span className="text-xs text-slate-500">
        File tersimpan sementara di server. Sambungkan Telegram agar tersimpan permanen.
      </span>
    </span>
  );
}
