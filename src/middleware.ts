import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { PrismaClient } from "@prisma/client";

const PUBLIC = [
  "/login",
  "/api/auth",
  "/api/webhooks/kommo",
  "/api/kommo/oauth",
];

// Prisma en middleware Edge no siempre funciona; usamos cookie/session y
// rutas de setup públicas controladas por AUTH_SETUP_OPEN.

function isPublic(pathname: string) {
  return PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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

  // Modo instalación: permite configurar hasta crear el primer admin
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
    await jwtVerify(token, new TextEncoder().encode(secret));
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
