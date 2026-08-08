import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/kommo/oauth";
import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";
import { kommoConfig } from "@/lib/kommo/config";

function subdomainFromReferer(referer: string | null) {
  if (!referer) return undefined;
  // Kommo envía referer tipo "corporacionaltaterra69.kommo.com"
  const host = referer.replace(/^https?:\/\//, "").split("/")[0];
  const sub = host.split(".")[0];
  return sub || undefined;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const referer = req.nextUrl.searchParams.get("referer");

  if (error) {
    return NextResponse.redirect(
      new URL(`/configuracion?error=${encodeURIComponent(error)}`, req.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/configuracion?error=missing_code", req.url),
    );
  }

  try {
    const subdomain = subdomainFromReferer(referer) || kommoConfig.subdomain;
    await exchangeCodeForTokens(code, subdomain);
    const account = await kommoApi.getAccount();
    await prisma.kommoAccount.update({
      where: { subdomain },
      data: { accountId: account.id },
    });
    return NextResponse.redirect(new URL("/configuracion?connected=1", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/configuracion?error=${encodeURIComponent(message)}`, req.url),
    );
  }
}
