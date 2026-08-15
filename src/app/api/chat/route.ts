import { NextRequest, NextResponse } from "next/server";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kommoApi, type KommoTalk } from "@/lib/kommo/client";
import { upsertLead } from "@/lib/sync/migrate";

function resolveDisplayName(
  leadName: string,
  contacts: Array<{ isPrimary: boolean; contact: { name: string; phone: string | null } }>,
) {
  const primary =
    contacts.find((c) => c.isPrimary)?.contact || contacts[0]?.contact || null;
  const generic = /^lead\s*#?\s*\d+$/i.test(leadName.trim());
  if (primary?.name && (generic || !leadName.trim())) {
    return { name: primary.name, phone: primary.phone };
  }
  return { name: leadName, phone: primary?.phone || null };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  const talkId = req.nextUrl.searchParams.get("talkId");

  try {
    if (talkId) {
      const messages = await kommoApi.getTalkMessages(Number(talkId));
      const list = [...(messages._embedded?.messages || [])].sort(
        (a, b) => (a.created_at || 0) - (b.created_at || 0),
      );
      return NextResponse.json({ messages: list });
    }

    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, deletedAt: null, ...leadScopeWhere(session) },
        include: {
          contacts: {
            include: { contact: true },
            orderBy: { isPrimary: "desc" },
          },
        },
      });
      if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

      const display = resolveDisplayName(lead.name, lead.contacts);
      const talks = await kommoApi.getTalks({
        entityId: lead.kommoId,
        onlyInWork: false,
      });
      return NextResponse.json({
        lead: {
          id: lead.id,
          name: display.name,
          phone: display.phone,
          kommoId: lead.kommoId,
        },
        talks: talks._embedded?.talks || [],
      });
    }

    const recentTalks = await kommoApi.getTalks({ onlyInWork: true });
    const talksList = recentTalks._embedded?.talks || [];

    for (const talk of talksList.slice(0, 30)) {
      if (!talk.entity_id) continue;
      const type = String(talk.entity_type || "lead").toLowerCase();
      if (type && type !== "lead" && type !== "2" && type !== "leads") continue;
      const exists = await prisma.lead.findUnique({ where: { kommoId: talk.entity_id } });
      if (!exists) {
        try {
          const remote = await kommoApi.getLead(talk.entity_id);
          await upsertLead(remote);
        } catch {
          // ignore
        }
      }
    }

    const myLeads = await prisma.lead.findMany({
      where: { deletedAt: null, ...leadScopeWhere(session) },
      include: {
        contacts: {
          include: { contact: true },
          orderBy: { isPrimary: "desc" },
        },
      },
      take: 80,
      orderBy: { updatedAt: "desc" },
    });

    const leadOptions = myLeads.map((l) => {
      const display = resolveDisplayName(l.name, l.contacts);
      return {
        id: l.id,
        name: display.name,
        phone: display.phone,
        kommoId: l.kommoId,
      };
    });

    const byKommoId = new Map(
      leadOptions.map((l) => [l.kommoId, l] as const),
    );
    const inbox: Array<{
      talk: KommoTalk;
      lead: { id: string; name: string; phone: string | null; kommoId: number };
    }> = [];

    for (const talk of talksList) {
      if (!talk.entity_id) continue;
      const lead = byKommoId.get(talk.entity_id);
      if (!lead) continue;
      inbox.push({ talk, lead });
    }

    if (!inbox.length) {
      for (const lead of leadOptions.slice(0, 25)) {
        const res = await kommoApi.getTalks({ entityId: lead.kommoId, onlyInWork: true });
        for (const talk of res._embedded?.talks || []) {
          inbox.push({ talk, lead });
        }
      }
    }

    inbox.sort((a, b) => (b.talk.updated_at || 0) - (a.talk.updated_at || 0));
    return NextResponse.json({ inbox: inbox.slice(0, 50), leads: leadOptions });
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
