import { LABEL_STATUS_IURAN, WARNA_STATUS_IURAN, LABEL_METODE_BAYAR } from "@/lib/format";

/** Badge status iuran/pembayaran (label + warna konsisten di semua halaman finance). */
export function BadgeIuran({ status }: { status: string }) {
  const warna = WARNA_STATUS_IURAN[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  const label = LABEL_STATUS_IURAN[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${warna}`}>
      {label}
    </span>
  );
}

export function BadgeMetode({ metode }: { metode: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
      {LABEL_METODE_BAYAR[metode] ?? metode}
    </span>
  );
}
