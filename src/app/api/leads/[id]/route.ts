import { NextRequest, NextResponse } from "next/server";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";

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
  };

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
  let status = lead.status;

  if (body.stageId) {
    const stage = await prisma.stage.findUnique({ where: { id: body.stageId } });
    if (!stage) {
      return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
    }
    stageKommoId = stage.kommoId;
    if (stage.isWon) status = "won";
    else if (stage.isLost) status = "lost";
    else status = "active";
  }

  if (body.pipelineId) {
    const pipeline = await prisma.pipeline.findUnique({ where: { id: body.pipelineId } });
    if (!pipeline) {
      return NextResponse.json({ error: "Embudo inválido" }, { status: 400 });
    }
    pipelineKommoId = pipeline.kommoId;
  }

  try {
    await kommoApi.updateLead({
      id: lead.kommoId,
      ...(stageKommoId !== undefined ? { status_id: stageKommoId } : {}),
      ...(pipelineKommoId !== undefined ? { pipeline_id: pipelineKommoId } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error Kommo";
    return NextResponse.json({ error: `No se pudo actualizar en Kommo: ${message}` }, { status: 400 });
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(body.stageId ? { stageId: body.stageId } : {}),
      ...(body.pipelineId ? { pipelineId: body.pipelineId } : {}),
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
