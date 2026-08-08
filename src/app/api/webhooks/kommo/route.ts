import { NextRequest, NextResponse } from "next/server";
import { processWebhookPayload } from "@/lib/sync/webhooks";
import { kommoConfig } from "@/lib/kommo/config";

export async function POST(req: NextRequest) {
  try {
    if (kommoConfig.webhookSecret) {
      const secret = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");
      if (secret !== kommoConfig.webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const contentType = req.headers.get("content-type") || "";
    let payload: Record<string, unknown>;

    if (contentType.includes("application/json")) {
      payload = (await req.json()) as Record<string, unknown>;
    } else {
      // Kommo a menudo envía application/x-www-form-urlencoded
      const form = await req.formData();
      const raw: Record<string, unknown> = {};
      form.forEach((value, key) => {
        // Soporta claves anidadas tipo leads[add][0][id]
        setNested(raw, key, value.toString());
      });
      payload = raw;
    }

    const result = await processWebhookPayload(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    console.error("Webhook error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function setNested(obj: Record<string, unknown>, path: string, value: string) {
  const parts = path.replace(/\]/g, "").split("[");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      current[part] = value;
      return;
    }
    if (!(part in current) || typeof current[part] !== "object") {
      const nextIsIndex = /^\d+$/.test(parts[i + 1] || "");
      current[part] = nextIsIndex ? [] : {};
    }
    current = current[part] as Record<string, unknown>;
  }
}
