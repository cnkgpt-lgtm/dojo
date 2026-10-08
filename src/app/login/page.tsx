import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-dojo-100 px-4 py-10">
      <div className="anim-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Logo dojo: kotak brutalist */}
          <div
            aria-hidden="true"
            className="brutal-title mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-black bg-dojo-600 text-2xl text-white shadow-[4px_4px_0px_0px_#000]"
          >
            DK
          </div>
          <h1 className="brutal-title text-3xl">DOJOKU</h1>
          <p className="mt-2">
            <span className="brutal-badge bg-white text-black">
              Sistem Manajemen Member Karate &amp; Dojo
            </span>
          </p>
        </div>

        <section aria-label="Formulir masuk" className="brutal-card p-6">
          {/* Suspense: LoginForm memakai useSearchParams (callbackUrl) */}
          <Suspense fallback={<p className="py-8 text-center text-sm font-bold text-slate-500">Memuat formulir...</p>}>
            <LoginForm />
          </Suspense>
        </section>

        <p className="mt-6 text-center text-sm font-bold">
          Lupa kata sandi?{" "}
          <Link href="/lupa-password" className="text-dojo-700 underline decoration-2 underline-offset-2 hover:text-dojo-800">
            Atur ulang di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
