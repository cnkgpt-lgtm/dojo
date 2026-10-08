export default function SiswaLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat data siswa" className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
