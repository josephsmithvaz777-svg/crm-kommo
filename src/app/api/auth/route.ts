import { NextRequest, NextResponse } from "next/server";
import { getSession, loginWithEmailPassword, destroySession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ user: session });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }
    const user = await loginWithEmailPassword(body.email, body.password);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
