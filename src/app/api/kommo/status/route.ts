import { NextResponse } from "next/server";
import { getKommoConnectionStatus } from "@/lib/kommo/oauth";
import { prisma } from "@/lib/db";

export async function GET() {
  const status = await getKommoConnectionStatus();
  const counts = {
    leads: await prisma.lead.count({ where: { deletedAt: null } }),
    contacts: await prisma.contact.count({ where: { deletedAt: null } }),
    companies: await prisma.company.count({ where: { deletedAt: null } }),
    tasks: await prisma.task.count(),
    notes: await prisma.note.count(),
    users: await prisma.user.count(),
    pipelines: await prisma.pipeline.count(),
  };

  const lastJob = await prisma.syncJob.findFirst({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({ ...status, counts, lastJob });
}
