const GAYA: Record<string, string> = {
  AKTIF: "brutal-badge bg-emerald-300 text-black",
  CUTI: "brutal-badge bg-amber-300 text-black",
  TIDAK_AKTIF: "brutal-badge bg-neutral-200 text-neutral-700",
  KELUAR: "brutal-badge bg-neutral-200 text-neutral-700",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={GAYA[status] ?? GAYA.TIDAK_AKTIF}>{label}</span>;
}
