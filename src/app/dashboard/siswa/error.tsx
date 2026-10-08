"use client";

export default function SiswaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-8 text-center ring-1 ring-red-200">
      <p className="font-bold text-red-800">Gagal memuat data siswa</p>
      <p className="mt-1 text-sm text-red-600">
        {error.message || "Terjadi kesalahan. Periksa koneksi internet Anda."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-red-700 px-5 text-sm font-semibold text-white"
      >
        Coba lagi
      </button>
    </div>
  );
}
