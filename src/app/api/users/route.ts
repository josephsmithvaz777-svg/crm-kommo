import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

function setupOpen() {
  return process.env.AUTH_SETUP_OPEN === "true";
}

export async function GET() {
  const session = await getSession();
  const open = setupOpen();

  if (!session && !open) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where:
      !session || session.role === "admin" || open
        ? {}
        : { id: session.id },
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

/** Admin (o modo instalación): asigna contraseña / rol */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    const open = setupOpen();

    if (!open && (!session || session.role !== "admin")) {
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Admin (o modo instalación): crea un asesor local, sin usuario de Kommo */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const open = setupOpen();

    if (!open && (!session || session.role !== "admin")) {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: "admin" | "agent";
    };

    const name = body.name?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    const role = body.role === "admin" ? "admin" : "agent";

    if (!name) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Contraseña de al menos 6 caracteres" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
        isActive: true,
        inAssignPool: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
