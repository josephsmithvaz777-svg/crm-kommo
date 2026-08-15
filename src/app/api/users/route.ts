import { NextRequest, NextResponse } from "next/server";
import { decryptPassword, encryptPassword, getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

function setupOpen() {
  return process.env.AUTH_SETUP_OPEN === "true";
}

async function requireAdmin() {
  const session = await getSession();
  const open = setupOpen();
  if (!open && (!session || session.role !== "admin")) {
    return { session, error: NextResponse.json({ error: "Solo admin" }, { status: 403 }) };
  }
  return { session, error: null as NextResponse | null, open };
}

export async function GET() {
  const session = await getSession();
  const open = setupOpen();

  if (!session && !open) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const canReveal = Boolean(open || session?.role === "admin");

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
      passwordEncrypted: true,
      _count: { select: { leads: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    users: users.map(({ passwordHash, passwordEncrypted, ...u }) => ({
      ...u,
      hasPassword: Boolean(passwordHash),
      passwordReveal: canReveal ? decryptPassword(passwordEncrypted) : null,
    })),
    currentUserId: session?.id ?? null,
  });
}

/** Admin (o modo instalación): asigna contraseña / rol */
export async function PATCH(req: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

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
      passwordEncrypted?: string;
      role?: string;
      email?: string | null;
    } = {};
    if (body.password) {
      data.passwordHash = await hashPassword(body.password);
      data.passwordEncrypted = encryptPassword(body.password);
    }
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
    const { error } = await requireAdmin();
    if (error) return error;

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
        passwordEncrypted: encryptPassword(password),
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

/** Admin: elimina un asesor y deja sus leads sin asignar */
export async function DELETE(req: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const body = (await req.json()) as { userId?: string };
    if (!body.userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    if (session?.id === body.userId) {
      return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, role: true, name: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (target.role === "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) {
        return NextResponse.json({ error: "No se puede eliminar al último admin" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.lead.updateMany({
        where: { responsibleId: body.userId },
        data: { responsibleId: null },
      });
      await tx.contact.updateMany({
        where: { responsibleId: body.userId },
        data: { responsibleId: null },
      });
      await tx.company.updateMany({
        where: { responsibleId: body.userId },
        data: { responsibleId: null },
      });
      await tx.task.updateMany({
        where: { responsibleId: body.userId },
        data: { responsibleId: null },
      });
      await tx.notification.deleteMany({ where: { userId: body.userId } });
      await tx.user.delete({ where: { id: body.userId } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
