import Link from "next/link";

/** Navigasi halaman untuk daftar server-rendered. */
export function Pagination({
  halaman,
  totalHalaman,
  buatHref,
}: {
  halaman: number;
  totalHalaman: number;
  buatHref: (halaman: number) => string;
}) {
  if (totalHalaman <= 1) return null;
  const gaya = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3 text-sm font-semibold ring-1";
  return (
    <nav aria-label="Halaman" className="mt-6 flex items-center justify-center gap-2">
      {halaman > 1 ? (
        <Link href={buatHref(halaman - 1)} className={`${gaya} text-slate-700 ring-slate-200`}>
          Sebelumnya
        </Link>
      ) : (
        <span aria-hidden="true" className={`${gaya} cursor-not-allowed text-slate-300 ring-slate-100`}>
          Sebelumnya
        </span>
      )}
      <span className="px-2 text-sm text-slate-500" aria-current="page">
        Halaman {halaman} dari {totalHalaman}
      </span>
      {halaman < totalHalaman ? (
        <Link href={buatHref(halaman + 1)} className={`${gaya} text-slate-700 ring-slate-200`}>
          Berikutnya
        </Link>
      ) : (
        <span aria-hidden="true" className={`${gaya} cursor-not-allowed text-slate-300 ring-slate-100`}>
          Berikutnya
        </span>
      )}
    </nav>
  );
}
