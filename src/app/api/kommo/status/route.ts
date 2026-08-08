import { NextResponse } from "next/server";
import { getKommoConnectionStatus } from "@/lib/kommo/oauth";
import { prisma } from "@/lib/db";
import { contactScopeWhere, getSession, leadScopeWhere } from "@/lib/auth";

export async function GET() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  await prisma.syncJob.updateMany({
    where: {
      status: { in: ["running", "pending"] },
      OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, createdAt: { lt: cutoff } }],
    },
    data: {
      status: "failed",
      message: "Interrumpido (timeout en Vercel). Pulsa Migración completa otra vez.",
      finishedAt: new Date(),
    },
  });

  const session = await getSession();
  const status = await getKommoConnectionStatus();

  const leadWhere = {
    deletedAt: null as null,
    ...(session ? leadScopeWhere(session) : {}),
  };
  const contactWhere = {
    deletedAt: null as null,
    ...(session ? contactScopeWhere(session) : {}),
  };

  const counts = {
    leads: await prisma.lead.count({ where: leadWhere }),
    contacts: await prisma.contact.count({ where: contactWhere }),
    companies:
      session?.role === "agent"
        ? 0
        : await prisma.company.count({ where: { deletedAt: null } }),
    tasks: session?.role === "agent" ? 0 : await prisma.task.count(),
    notes: session?.role === "agent" ? 0 : await prisma.note.count(),
    users: session?.role === "agent" ? 1 : await prisma.user.count(),
    pipelines: await prisma.pipeline.count(),
  };

  const lastJob = await prisma.syncJob.findFirst({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    ...status,
    counts,
    lastJob,
    user: session,
  });
}
