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
  const gaya = "brutal-btn brutal-btn-light px-3";
  return (
    <nav aria-label="Halaman" className="mt-6 flex items-center justify-center gap-2">
      {halaman > 1 ? (
        <Link href={buatHref(halaman - 1)} className={gaya}>
          Sebelumnya
        </Link>
      ) : (
        <span aria-hidden="true" className={`${gaya} cursor-not-allowed opacity-50`}>
          Sebelumnya
        </span>
      )}
      <span className="px-2 text-sm font-bold" aria-current="page">
        Halaman {halaman} dari {totalHalaman}
      </span>
      {halaman < totalHalaman ? (
        <Link href={buatHref(halaman + 1)} className={gaya}>
          Berikutnya
        </Link>
      ) : (
        <span aria-hidden="true" className={`${gaya} cursor-not-allowed opacity-50`}>
          Berikutnya
        </span>
      )}
    </nav>
  );
}
