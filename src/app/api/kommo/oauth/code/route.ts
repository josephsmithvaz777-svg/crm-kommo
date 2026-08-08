import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/kommo/oauth";
import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";
import { kommoConfig } from "@/lib/kommo/config";

/** Intercambia el código de autorización de la ficha de la integración privada. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { code?: string };
    const code = body.code?.trim();
    if (!code) {
      return NextResponse.json({ error: "Falta el código de autorización" }, { status: 400 });
    }

    await exchangeCodeForTokens(code, kommoConfig.subdomain);
    const account = await kommoApi.getAccount();
    await prisma.kommoAccount.update({
      where: { subdomain: kommoConfig.subdomain },
      data: { accountId: account.id },
    });

    return NextResponse.json({ ok: true, accountId: account.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
