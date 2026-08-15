import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = [
  "/login",
  "/api/auth",
  "/api/webhooks/kommo",
  "/api/kommo/oauth",
];

const ADMIN_ONLY_PATHS = [
  "/equipo",
  "/reparto",
  "/configuracion",
  "/api/assignment",
  "/api/sync",
  "/api/users",
  "/api/webhooks/register",
  "/api/kommo/disconnect",
];

function isPublic(pathname: string) {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminOnly(pathname: string) {
  return ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    isPublic(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (process.env.AUTH_SETUP_OPEN === "true") {
    return NextResponse.next();
  }

  const token = req.cookies.get("crm_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    const secret =
      process.env.AUTH_SECRET || process.env.KOMMO_CLIENT_SECRET || "dev-secret-change-me";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role === "admin" ? "admin" : "agent";

    if (role !== "admin" && isAdminOnly(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Solo admin" }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
