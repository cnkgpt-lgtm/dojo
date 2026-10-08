"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        signOut({ callbackUrl: "/login" });
      }}
      className={
        compact
          ? "rounded-lg px-3 py-2 text-sm font-semibold text-dojo-700 hover:bg-dojo-50 disabled:opacity-60"
          : "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      }
    >
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
