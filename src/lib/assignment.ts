import { prisma } from "@/lib/db";

const KEY_AUTO = "lead_auto_assign";
const KEY_CURSOR = "lead_assign_cursor";

export async function getSetting(key: string, fallback = "") {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function isAutoAssignEnabled() {
  const v = await getSetting(KEY_AUTO, "true");
  return v === "true";
}

/** Usuarios del pool de reparto: activos, con login y en el pool */
export async function getAssignPool() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      inAssignPool: true,
      passwordHash: { not: null },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      inAssignPool: true,
      _count: { select: { leads: true } },
    },
  });
}

/**
 * Siguiente asesor en round-robin.
 * Solo afecta ConexiónCRM (no cambia el responsable en Kommo: 1 licencia).
 */
export async function pickNextAssignee() {
  const pool = await getAssignPool();
  if (!pool.length) return null;

  const cursor = await getSetting(KEY_CURSOR, "");
  let index = pool.findIndex((u) => u.id === cursor);
  index = index >= 0 ? (index + 1) % pool.length : 0;
  const chosen = pool[index];
  await setSetting(KEY_CURSOR, chosen.id);
  return chosen;
}

export async function assignLeadToUser(leadId: string, userId: string) {
  return prisma.lead.update({
    where: { id: leadId },
    data: {
      responsibleId: userId,
      crmAssigned: true,
    },
    include: { responsible: true },
  });
}

/** Asigna un lead nuevo si el auto-reparto está activo y hay pool */
export async function autoAssignNewLead(leadId: string) {
  if (!(await isAutoAssignEnabled())) return null;
  const assignee = await pickNextAssignee();
  if (!assignee) return null;
  return assignLeadToUser(leadId, assignee.id);
}

/**
 * Redistribuye leads activos que aún no tienen asignación CRM
 * (o todos si forceAll).
 */
export async function redistributeLeads(options?: { forceAll?: boolean }) {
  const pool = await getAssignPool();
  if (!pool.length) {
    return { assigned: 0, message: "No hay asesores en el pool (activos + con contraseña + en pool)" };
  }

  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: { not: "deleted" },
      ...(options?.forceAll ? {} : { crmAssigned: false }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let assigned = 0;
  for (const lead of leads) {
    const assignee = await pickNextAssignee();
    if (!assignee) break;
    await assignLeadToUser(lead.id, assignee.id);
    assigned += 1;
  }

  return {
    assigned,
    poolSize: pool.length,
    message: `Asignados ${assigned} leads entre ${pool.length} asesores`,
  };
}

export async function getAssignmentConfig() {
  const [enabled, pool, cursor] = await Promise.all([
    isAutoAssignEnabled(),
    getAssignPool(),
    getSetting(KEY_CURSOR, ""),
  ]);

  const allCandidates = await prisma.user.findMany({
    where: { isActive: true, passwordHash: { not: null } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      inAssignPool: true,
      _count: { select: { leads: true } },
    },
  });

  return {
    autoAssign: enabled,
    cursorUserId: cursor || null,
    pool,
    candidates: allCandidates,
  };
}
