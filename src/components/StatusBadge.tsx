const GAYA: Record<string, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CUTI: "bg-amber-50 text-amber-700 ring-amber-200",
  TIDAK_AKTIF: "bg-slate-100 text-slate-600 ring-slate-200",
  KELUAR: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        GAYA[status] ?? GAYA.TIDAK_AKTIF
      }`}
    >
      {label}
    </span>
  );
}
