import { NextRequest, NextResponse } from "next/server";
import { kommoApi } from "@/lib/kommo/client";
import { RECOMMENDED_WEBHOOK_SETTINGS } from "@/lib/sync/webhooks";
import { kommoConfig } from "@/lib/kommo/config";

function sanitizeBaseUrl(raw: string) {
  let base = raw.trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
  // Si pegaron la URL completa del webhook por error, recortar
  base = base.replace(/\/api\/webhooks\/kommo.*$/i, "");
  return base;
}

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
    const body = (await req.json().catch(() => ({}))) as { destination?: string; baseUrl?: string };

    const rawBase =
      body.baseUrl ||
      body.destination ||
      process.env.NEXT_PUBLIC_APP_URL ||
      req.nextUrl.origin;

    const base = sanitizeBaseUrl(rawBase);
    let destination = body.destination?.includes("/api/webhooks/kommo")
      ? sanitizeBaseUrl(body.destination.replace(/\/api\/webhooks\/kommo.*$/i, "")) +
        "/api/webhooks/kommo"
      : `${base}/api/webhooks/kommo`;

    destination = destination.trim().replace(/^["']|["']$/g, "");

    if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(destination)) {
      return NextResponse.json(
        {
          error:
            "URL inválida para Kommo. Debe ser HTTPS público, ej: https://crm-kommo.vercel.app/api/webhooks/kommo",
          destination,
          hint: "En Vercel: NEXT_PUBLIC_APP_URL=https://crm-kommo.vercel.app (sin comillas)",
        },
        { status: 400 },
      );
    }

    if (/localhost|127\.0\.0\.1|example\.com/i.test(destination)) {
      return NextResponse.json(
        {
          error:
            "La URL no puede ser localhost ni example.com. Usa https://crm-kommo.vercel.app",
          destination,
        },
        { status: 400 },
      );
    }

    if (kommoConfig.webhookSecret) {
      const sep = destination.includes("?") ? "&" : "?";
      destination = `${destination}${sep}secret=${encodeURIComponent(kommoConfig.webhookSecret)}`;
    }

    const result = await kommoApi.subscribeWebhook(destination, RECOMMENDED_WEBHOOK_SETTINGS);
    return NextResponse.json({
      ok: true,
      destination,
      settings: RECOMMENDED_WEBHOOK_SETTINGS,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
