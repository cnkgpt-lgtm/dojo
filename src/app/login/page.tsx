import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="anim-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Placeholder logo (R-23): kotak identitas dojo, diganti logo resmi bila sudah ada */}
          <div
            aria-hidden="true"
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dojo-700 text-2xl font-extrabold tracking-tight text-white"
          >
            DK
          </div>
          <h1 className="text-2xl font-bold tracking-tight">DojoKu</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistem Manajemen Member Karate &amp; Dojo
          </p>
        </div>

        <section aria-label="Formulir masuk" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {/* Suspense: LoginForm memakai useSearchParams (callbackUrl) */}
          <Suspense fallback={<p className="py-8 text-center text-sm text-slate-500">Memuat formulir...</p>}>
            <LoginForm />
          </Suspense>
        </section>

        <p className="mt-6 text-center text-sm text-slate-500">
          Lupa kata sandi?{" "}
          <Link href="/lupa-password" className="font-semibold text-dojo-700 hover:text-dojo-800">
            Atur ulang di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
