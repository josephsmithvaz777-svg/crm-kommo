import { NextRequest, NextResponse } from "next/server";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";
import { upsertContact, upsertLead } from "@/lib/sync/migrate";
import { assignLeadToUser, autoAssignNewLead } from "@/lib/assignment";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pipelineId = req.nextUrl.searchParams.get("pipelineId");
  const q = req.nextUrl.searchParams.get("q");

  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(session ? leadScopeWhere(session) : {}),
      ...(pipelineId ? { pipelineId } : {}),
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { source: { contains: q } }],
          }
        : {}),
    },
    include: {
      stage: true,
      pipeline: true,
      responsible: true,
      company: true,
      contacts: { include: { contact: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ leads });
}

/** Crea lead + contacto en Kommo y en ConexiónCRM */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      email?: string;
      price?: number;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const phone = body.phone?.trim() || "";
    const email = body.email?.trim() || "";
    const price = Number(body.price) || 0;

    let pipeline = await prisma.pipeline.findFirst({
      where: { isMain: true },
      include: { stages: { orderBy: { sort: "asc" } } },
    });
    if (!pipeline) {
      pipeline = await prisma.pipeline.findFirst({
        include: { stages: { orderBy: { sort: "asc" } } },
      });
    }
    const firstStage =
      pipeline?.stages.find((s) => !s.isWon && !s.isLost) || pipeline?.stages[0];

    const custom_fields_values: Array<{
      field_code: string;
      values: Array<{ value: string; enum_code?: string }>;
    }> = [];
    if (phone) {
      custom_fields_values.push({
        field_code: "PHONE",
        values: [{ value: phone, enum_code: "WORK" }],
      });
    }
    if (email) {
      custom_fields_values.push({
        field_code: "EMAIL",
        values: [{ value: email, enum_code: "WORK" }],
      });
    }

    const contactRes = await kommoApi.createContact({
      name,
      ...(custom_fields_values.length ? { custom_fields_values } : {}),
    });
    const contactKommoId = contactRes._embedded?.contacts?.[0]?.id;
    if (!contactKommoId) {
      return NextResponse.json(
        { error: "Kommo no devolvió el contacto creado" },
        { status: 502 },
      );
    }

    const leadRes = await kommoApi.createLead({
      name,
      price,
      ...(pipeline ? { pipeline_id: pipeline.kommoId } : {}),
      ...(firstStage ? { status_id: firstStage.kommoId } : {}),
      _embedded: {
        contacts: [{ id: contactKommoId, is_main: true }],
      },
    });
    const leadKommoId = leadRes._embedded?.leads?.[0]?.id;
    if (!leadKommoId) {
      return NextResponse.json(
        { error: "Kommo no devolvió el lead creado" },
        { status: 502 },
      );
    }

    const remoteContact = await kommoApi.getContact(contactKommoId);
    const contact = await upsertContact(remoteContact);
    const remoteLead = await kommoApi.getLead(leadKommoId);
    let lead = await upsertLead(remoteLead);

    if (session?.role === "agent") {
      lead = (await assignLeadToUser(lead.id, session.id)) || lead;
    } else if (session?.role === "admin") {
      // upsertLead ya pudo auto-asignar; si no, forzar
      const fresh = await prisma.lead.findUnique({ where: { id: lead.id } });
      if (fresh && !fresh.crmAssigned) {
        const assigned = await autoAssignNewLead(lead.id);
        if (assigned) lead = assigned;
      }
    }

    return NextResponse.json({
      ok: true,
      lead: { id: lead.id, kommoId: lead.kommoId, name: lead.name },
      contact: {
        id: contact.id,
        kommoId: contact.kommoId,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear lead";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
