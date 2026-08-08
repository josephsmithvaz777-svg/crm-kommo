import { NextRequest, NextResponse } from "next/server";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kommoApi, type KommoTalk } from "@/lib/kommo/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  const talkId = req.nextUrl.searchParams.get("talkId");

  try {
    if (talkId) {
      const messages = await kommoApi.getTalkMessages(Number(talkId));
      return NextResponse.json({ messages: messages._embedded?.messages || [] });
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, deletedAt: null, ...leadScopeWhere(session) },
      });
      if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

      const talks = await kommoApi.getTalks({
        entityId: lead.kommoId,
        onlyInWork: false,
      });
      return NextResponse.json({
        lead: { id: lead.id, name: lead.name, kommoId: lead.kommoId },
        talks: talks._embedded?.talks || [],
      });
    }

    const myLeads = await prisma.lead.findMany({
      where: { deletedAt: null, ...leadScopeWhere(session) },
      select: { id: true, name: true, kommoId: true },
      take: 80,
      orderBy: { updatedAt: "desc" },
    });

    const inbox: Array<{ talk: KommoTalk; lead: { id: string; name: string; kommoId: number } }> =
      [];

    for (const lead of myLeads.slice(0, 25)) {
      const res = await kommoApi.getTalks({ entityId: lead.kommoId, onlyInWork: true });
      for (const talk of res._embedded?.talks || []) {
        inbox.push({ talk, lead });
      }
    }

    inbox.sort((a, b) => (b.talk.updated_at || 0) - (a.talk.updated_at || 0));
    return NextResponse.json({ inbox: inbox.slice(0, 50), leads: myLeads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error chat";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as { talkId?: number; text?: string; leadId?: string };
    if (!body.talkId || !body.text?.trim()) {
      return NextResponse.json({ error: "talkId y text requeridos" }, { status: 400 });
    }

    if (body.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: body.leadId, deletedAt: null, ...leadScopeWhere(session) },
      });
      if (!lead) return NextResponse.json({ error: "Sin acceso al lead" }, { status: 403 });
    }

    const result = await kommoApi.sendTalkMessage(body.talkId, body.text.trim());
    return NextResponse.json({ ok: true, messageId: result.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al enviar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
