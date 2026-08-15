import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyLeadMessage, notifyUser } from "@/lib/notifications";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [unreadCount, items] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.id, readAt: null },
    }),
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({ unreadCount, items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as {
    type?: "message" | "lead_assigned";
    title?: string;
    body?: string;
    href?: string;
    leadId?: string;
  };

  if (body.type === "message" && body.leadId) {
    await notifyLeadMessage(body.leadId, body.body, session.id);
    return NextResponse.json({ ok: true });
  }

  if (!body.title || !body.type) {
    return NextResponse.json({ error: "type y title requeridos" }, { status: 400 });
  }

  await notifyUser({
    userId: session.id,
    type: body.type,
    title: body.title,
    body: body.body,
    href: body.href,
    leadId: body.leadId,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json()) as { id?: string; all?: boolean };
  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: session.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: body.id, userId: session.id },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
