import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: session.role === "admin" ? {} : { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      kommoId: true,
      passwordHash: true,
      _count: { select: { leads: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    users: users.map(({ passwordHash, ...u }) => ({
      ...u,
      hasPassword: Boolean(passwordHash),
    })),
  });
}

/** Admin: asigna contraseña / rol a un asesor sincronizado desde Kommo */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const body = (await req.json()) as {
      userId?: string;
      password?: string;
      role?: "admin" | "agent";
      email?: string;
    };

    if (!body.userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    const data: {
      passwordHash?: string;
      role?: string;
      email?: string | null;
    } = {};
    if (body.password) data.passwordHash = await hashPassword(body.password);
    if (body.role) data.role = body.role;
    if (body.email !== undefined) data.email = body.email.trim() || null;

    const user = await prisma.user.update({
      where: { id: body.userId },
      data,
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status = message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
