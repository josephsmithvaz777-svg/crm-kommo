import { prisma } from "@/lib/db";

export type NotifyInput = {
  userId: string;
  type: "message" | "lead_assigned";
  title: string;
  body?: string;
  href?: string;
  leadId?: string;
};

/** Evita spam: no duplicar mismo tipo+lead en los últimos N segundos */
export async function notifyUser(input: NotifyInput, dedupeSeconds = 45) {
  const since = new Date(Date.now() - dedupeSeconds * 1000);
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      leadId: input.leadId || null,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body || null,
      href: input.href || null,
      leadId: input.leadId || null,
    },
  });
}

export async function notifyLeadMessage(leadId: string, preview?: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, responsibleId: true },
  });
  if (!lead) return;

  const title = `Nuevo mensaje · ${lead.name}`;
  const body = preview || "Tienes un mensaje nuevo en el chat";
  const href = `/chat?leadId=${lead.id}`;

  if (lead.responsibleId) {
    await notifyUser({
      userId: lead.responsibleId,
      type: "message",
      title,
      body,
      href,
      leadId: lead.id,
    });
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: "admin", isActive: true },
    select: { id: true },
  });
  for (const admin of admins) {
    await notifyUser({
      userId: admin.id,
      type: "message",
      title,
      body,
      href,
      leadId: lead.id,
    });
  }
}

export async function notifyLeadAssigned(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true },
  });
  if (!lead) return;

  await notifyUser({
    userId,
    type: "lead_assigned",
    title: `Lead asignado · ${lead.name}`,
    body: "Se te asignó un nuevo lead. Ábrelo para atenderlo.",
    href: `/leads`,
    leadId: lead.id,
  });
}
