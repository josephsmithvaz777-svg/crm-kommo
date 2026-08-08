import { NextRequest, NextResponse } from "next/server";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
