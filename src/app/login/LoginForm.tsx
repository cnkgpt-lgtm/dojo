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
        <label htmlFor="identitas" className="mb-1.5 block text-sm font-extrabold text-black">
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
          className="brutal-input !text-base placeholder:text-slate-400"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-extrabold text-black">
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
          className="brutal-input !text-base placeholder:text-slate-400"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border-2 border-black bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-[2px_2px_0px_0px_#000]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="brutal-btn brutal-btn-primary !min-h-[52px] w-full !text-base"
      >
        {loading ? "Memeriksa..." : "MASUK"}
      </button>
    </form>
  );
}
