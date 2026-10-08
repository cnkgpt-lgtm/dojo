import Link from "next/link";

export default function LupaPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="anim-fade-up w-full max-w-sm text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dojo-700 text-2xl font-extrabold text-white"
        >
          DK
        </div>
        <h1 className="text-xl font-bold">Lupa Kata Sandi</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Untuk keamanan, pengaturan ulang kata sandi dilakukan oleh admin atau
          sensei dojo Anda. Silakan hubungi pengurus dojo dan minta kata sandi
          baru.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-dojo-700 px-8 text-base font-bold text-white hover:bg-dojo-800"
        >
          Kembali ke Halaman Masuk
        </Link>
      </div>
    </main>
  );
}
