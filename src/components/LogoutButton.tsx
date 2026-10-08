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
          ? "brutal-btn brutal-btn-light !min-h-[40px] !px-3 !py-1.5 !text-xs"
          : "brutal-btn brutal-btn-light w-full"
      }
    >
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
