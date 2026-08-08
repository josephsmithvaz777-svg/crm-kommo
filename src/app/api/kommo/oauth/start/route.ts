import { NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/kommo/oauth";

export async function GET() {
  try {
    const url = getAuthorizeUrl(`crm-${Date.now()}`);
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error OAuth";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
