import { NextRequest, NextResponse } from "next/server";
import { kommoApi } from "@/lib/kommo/client";
import { RECOMMENDED_WEBHOOK_SETTINGS } from "@/lib/sync/webhooks";
import { kommoConfig } from "@/lib/kommo/config";

export async function GET() {
  try {
    const data = await kommoApi.listWebhooks();
    return NextResponse.json({ webhooks: data._embedded?.webhooks || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { destination?: string };
    const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    let destination =
      body.destination || `${base}/api/webhooks/kommo`;

    if (kommoConfig.webhookSecret) {
      const sep = destination.includes("?") ? "&" : "?";
      destination = `${destination}${sep}secret=${encodeURIComponent(kommoConfig.webhookSecret)}`;
    }

    await kommoApi.subscribeWebhook(destination, RECOMMENDED_WEBHOOK_SETTINGS);
    return NextResponse.json({ ok: true, destination, settings: RECOMMENDED_WEBHOOK_SETTINGS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
