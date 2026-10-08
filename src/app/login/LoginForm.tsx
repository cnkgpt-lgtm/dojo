"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [identitas, setIdentitas] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const hasil = await signIn("credentials", {
        identitas,
        password,
        redirect: false,
      });
      if (hasil?.error) {
        setError("Nomor HP/email atau kata sandi salah. Silakan coba lagi.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Periksa koneksi internet Anda lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      <div>
        <label htmlFor="identitas" className="mb-1.5 block text-sm font-medium text-slate-700">
          Nomor HP / Email
        </label>
        <input
          id="identitas"
          name="identitas"
          type="text"
          autoComplete="username"
          required
          value={identitas}
          onChange={(e) => setIdentitas(e.target.value)}
          placeholder="08xxxxxxxxxx atau nama@email.com"
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-base placeholder:text-slate-400 focus:border-dojo-700"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Kata Sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Masukkan kata sandi"
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-base placeholder:text-slate-400 focus:border-dojo-700"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-dojo-50 px-4 py-3 text-sm font-medium text-dojo-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="min-h-[52px] w-full rounded-xl bg-dojo-700 text-base font-bold text-white transition-colors hover:bg-dojo-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Memeriksa..." : "MASUK"}
      </button>
    </form>
  );
}
