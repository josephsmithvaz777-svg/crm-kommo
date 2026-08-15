import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";
import {
  restoreLead,
  softDeleteLead,
  upsertCompany,
  upsertContact,
  upsertLead,
  upsertTask,
} from "./migrate";

type WebhookPayload = Record<string, unknown>;

function asArray<T>(value: unknown): T[] {
  if (!value) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function extractIds(section: unknown): number[] {
  const items = asArray<{ id?: number | string; element?: { id?: number } }>(section);
  return items
    .map((item) => Number(item.id ?? item.element?.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/** IDs de lead asociados a talks/mensajes (WhatsApp, etc.) */
function extractLeadIdsFromChatEvents(section: unknown): number[] {
  const items = asArray<Record<string, unknown>>(section);
  const ids: number[] = [];
  for (const item of items) {
    const nested = (item.element || item.entity || {}) as Record<string, unknown>;
    const entityId = Number(
      item.entity_id ?? item.element_id ?? nested.id ?? item.lead_id,
    );
    const entityType = String(
      item.entity_type ?? item.element_type ?? nested.type ?? "lead",
    ).toLowerCase();
    const isLead =
      !entityType ||
      entityType === "lead" ||
      entityType === "2" ||
      entityType === "leads";
    if (isLead && Number.isFinite(entityId) && entityId > 0) {
      ids.push(entityId);
    }
  }
  return [...new Set(ids)];
}

/**
 * Procesa webhooks de Kommo:
 * - lead add/update/status/delete/restore
 * - contact update
 * - task add/complete
 * - talk/message → refresca el lead ligado (sin migración completa)
 */
export async function processWebhookPayload(payload: WebhookPayload) {
  const event = await prisma.webhookEvent.create({
    data: {
      event: detectEventName(payload),
      payload: JSON.stringify(payload),
      processed: false,
    },
  });

  try {
    const leads = (payload.leads || payload.lead) as Record<string, unknown> | undefined;
    const contacts = (payload.contacts || payload.contact) as Record<string, unknown> | undefined;
    const companies = (payload.companies || payload.company) as
      | Record<string, unknown>
      | undefined;
    const tasks = (payload.tasks || payload.task) as Record<string, unknown> | undefined;
    const talks = (payload.talks || payload.talk) as Record<string, unknown> | undefined;
    const messages = (payload.messages || payload.message) as Record<string, unknown> | undefined;

    if (leads) {
      for (const id of extractIds(leads.add)) {
        const remote = await kommoApi.getLead(id);
        await upsertLead(remote);
      }
      for (const id of extractIds(leads.update)) {
        const remote = await kommoApi.getLead(id);
        await upsertLead(remote);
      }
      for (const id of extractIds(leads.status)) {
        const remote = await kommoApi.getLead(id);
        await upsertLead(remote);
      }
      for (const id of extractIds(leads.responsible)) {
        const remote = await kommoApi.getLead(id);
        await upsertLead(remote);
      }
      for (const id of extractIds(leads.delete)) {
        await softDeleteLead(id);
      }
      for (const id of extractIds(leads.restore)) {
        await restoreLead(id);
      }
    }

    if (contacts) {
      for (const id of [...extractIds(contacts.add), ...extractIds(contacts.update)]) {
        const remote = await kommoApi.getContact(id);
        await upsertContact(remote);
      }
    }

    if (companies) {
      for (const id of [...extractIds(companies.add), ...extractIds(companies.update)]) {
        const remote = await kommoApi.getCompany(id);
        await upsertCompany(remote);
      }
    }

    if (tasks) {
      for (const id of [
        ...extractIds(tasks.add),
        ...extractIds(tasks.update),
        ...extractIds(tasks.complete),
      ]) {
        const remote = await kommoApi.getTask(id);
        await upsertTask(remote);
      }
    }

    const chatLeadIds = new Set<number>();
    if (talks) {
      for (const action of Object.values(talks)) {
        for (const id of extractLeadIdsFromChatEvents(action)) chatLeadIds.add(id);
      }
    }
    if (messages) {
      for (const action of Object.values(messages)) {
        for (const id of extractLeadIdsFromChatEvents(action)) chatLeadIds.add(id);
      }
    }
    for (const id of chatLeadIds) {
      try {
        const remote = await kommoApi.getLead(id);
        const lead = await upsertLead(remote);
        const { notifyLeadMessage } = await import("@/lib/notifications");
        await notifyLeadMessage(lead.id, "Nuevo mensaje en WhatsApp / chat");
      } catch {
        // lead puede no existir aún; el poll de chat lo reintentará
      }
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processed: true },
    });

    return { ok: true, eventId: event.id, event: event.event };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error procesando webhook";
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: message },
    });
    throw error;
  }
}

function detectEventName(payload: WebhookPayload): string {
  const keys = Object.keys(payload).filter((k) =>
    [
      "leads",
      "lead",
      "contacts",
      "contact",
      "tasks",
      "task",
      "companies",
      "company",
      "talks",
      "talk",
      "messages",
      "message",
    ].includes(k),
  );
  if (!keys.length) return "unknown";
  const root = keys[0];
  const section = payload[root] as Record<string, unknown> | undefined;
  if (!section || typeof section !== "object") return root;
  const action = Object.keys(section)[0] || "event";
  return `${root}.${action}`;
}

/** Eventos recomendados al registrar webhooks en Kommo */
export const RECOMMENDED_WEBHOOK_SETTINGS = [
  "add_lead",
  "update_lead",
  "status_lead",
  "delete_lead",
  "restore_lead",
  "responsible_lead",
  "add_contact",
  "update_contact",
  "add_task",
  "add_talk",
  "add_message",
];
