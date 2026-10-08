import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIK = ["/login", "/lupa-password", "/api/auth"];

// Middleware ringan (Edge): hanya cek keberadaan cookie sesi.
// Verifikasi kriptografis + guard per-role dilakukan di layout server via auth().
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublik = PUBLIK.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublik) {
    // Sudah login tapi buka /login -> lempar ke dashboard
    if (pathname === "/login") {
      const token =
        req.cookies.get("__Secure-authjs.session-token")?.value ??
        req.cookies.get("authjs.session-token")?.value;
      if (token) return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  const token =
    req.cookies.get("__Secure-authjs.session-token")?.value ??
    req.cookies.get("authjs.session-token")?.value;

  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)).*)"],
};
