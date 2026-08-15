import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { kommoConfig } from "@/lib/kommo/config";

/** Borra tokens Kommo locales para forzar reautorización OAuth. */
export async function POST() {
  if (!kommoConfig.subdomain) {
    return NextResponse.json({ error: "Falta KOMMO_SUBDOMAIN" }, { status: 400 });
  }

  await prisma.kommoAccount.deleteMany({
    where: { subdomain: kommoConfig.subdomain },
  });

  return NextResponse.json({ ok: true });
}
