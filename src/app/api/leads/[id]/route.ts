import { NextRequest, NextResponse } from "next/server";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";
import { assignLeadToUser } from "@/lib/assignment";
import { syncPipelines } from "@/lib/sync/migrate";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    stageId?: string;
    pipelineId?: string;
    name?: string;
    price?: number;
    responsibleId?: string | null;
  };

  if (body.responsibleId !== undefined) {
    const isAdmin =
      process.env.AUTH_SETUP_OPEN === "true" || session?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Solo admin puede reasignar" }, { status: 403 });
    }

    if (body.responsibleId) {
      const user = await prisma.user.findUnique({ where: { id: body.responsibleId } });
      if (!user) {
        return NextResponse.json({ error: "Asesor inválido" }, { status: 400 });
      }
      const lead = await assignLeadToUser(id, body.responsibleId);
      return NextResponse.json({ lead });
    }

    const cleared = await prisma.lead.update({
      where: { id },
      data: { responsibleId: null, crmAssigned: false },
      include: { responsible: true, stage: true, pipeline: true },
    });
    return NextResponse.json({ lead: cleared });
  }

  const lead = await prisma.lead.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(session ? leadScopeWhere(session) : {}),
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead no encontrado o sin permiso" }, { status: 404 });
  }

  let stageKommoId: number | undefined;
  let pipelineKommoId: number | undefined;
  let nextStageId = body.stageId;
  let nextPipelineId = body.pipelineId;
  let status = lead.status;

  if (body.stageId) {
    // Usar siempre el embudo de la etapa (evita status_id inválido)
    let stage = await prisma.stage.findUnique({
      where: { id: body.stageId },
      include: { pipeline: true },
    });

    if (!stage) {
      return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
    }

    // Refrescar embudos desde Kommo por si los IDs cambiaron
    try {
      await syncPipelines();
      const refreshed = await prisma.stage.findUnique({
        where: { id: body.stageId },
        include: { pipeline: true },
      });
      if (refreshed) stage = refreshed;
    } catch {
      // seguir con datos locales
    }

    stageKommoId = stage.kommoId;
    pipelineKommoId = stage.pipeline.kommoId;
    nextStageId = stage.id;
    nextPipelineId = stage.pipelineId;

    if (stage.isWon) status = "won";
    else if (stage.isLost) status = "lost";
    else status = "active";
  } else if (body.pipelineId) {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: body.pipelineId } });
    if (!pipeline) {
      return NextResponse.json({ error: "Embudo inválido" }, { status: 400 });
    }
    pipelineKommoId = pipeline.kommoId;
    nextPipelineId = pipeline.id;
  }

  // Confirmar pipeline real del lead en Kommo si solo movemos etapa
  if (stageKommoId !== undefined && pipelineKommoId === undefined) {
    try {
      const remote = await kommoApi.getLead(lead.kommoId);
      if (remote.pipeline_id) pipelineKommoId = remote.pipeline_id;
    } catch {
      // ignore
    }
  }

  try {
    const payload: {
      id: number;
      status_id?: number;
      pipeline_id?: number;
      name?: string;
      price?: number;
    } = { id: lead.kommoId };

    if (stageKommoId !== undefined) payload.status_id = stageKommoId;
    if (pipelineKommoId !== undefined) payload.pipeline_id = pipelineKommoId;
    if (body.name !== undefined) payload.name = body.name;
    if (body.price !== undefined) payload.price = body.price;

    await kommoApi.updateLead(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error Kommo";
    // Actualizar igual en CRM local para que el agente no se quede bloqueado
    const updatedLocal = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        ...(nextStageId ? { stageId: nextStageId } : {}),
        ...(nextPipelineId ? { pipelineId: nextPipelineId } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        status,
      },
      include: { stage: true, pipeline: true, responsible: true },
    });

    return NextResponse.json(
      {
        lead: updatedLocal,
        warning: `Guardado en ConexiónCRM, pero Kommo rechazó el cambio: ${message}. Ejecuta Migración completa para refrescar etapas.`,
      },
      { status: 200 },
    );
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(nextStageId ? { stageId: nextStageId } : {}),
      ...(nextPipelineId ? { pipelineId: nextPipelineId } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      status,
    },
    include: {
      stage: true,
      pipeline: true,
      responsible: true,
    },
  });

  return NextResponse.json({ lead: updated });
}
