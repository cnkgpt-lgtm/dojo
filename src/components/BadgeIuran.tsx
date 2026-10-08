import { LABEL_STATUS_IURAN, WARNA_STATUS_IURAN, LABEL_METODE_BAYAR } from "@/lib/format";

/** Badge status iuran/pembayaran (label + warna konsisten di semua halaman finance). */
export function BadgeIuran({ status }: { status: string }) {
  const warna = WARNA_STATUS_IURAN[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  const label = LABEL_STATUS_IURAN[status] ?? status;
  return (
    <span className={`brutal-badge ${warna}`}>
      {label}
    </span>
  );
}

export function BadgeMetode({ metode }: { metode: string }) {
  return (
    <span className="brutal-badge bg-slate-100 text-slate-600">
      {LABEL_METODE_BAYAR[metode] ?? metode}
    </span>
  );
}
