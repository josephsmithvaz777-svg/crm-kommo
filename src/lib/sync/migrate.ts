import { prisma } from "@/lib/db";
import {
  kommoApi,
  type KommoCompany,
  type KommoContact,
  type KommoLead,
  type KommoNote,
  type KommoTask,
} from "@/lib/kommo/client";
import { customFieldsToJson, extractPhoneEmail, tagsToJson, ts } from "./mappers";

async function updateJob(
  jobId: string,
  data: { progress?: number; total?: number; message?: string; status?: string },
) {
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      ...data,
      ...(data.status === "completed" || data.status === "failed"
        ? { finishedAt: new Date() }
        : {}),
    },
  });
}

export async function upsertUser(u: {
  id: number;
  name: string;
  email?: string;
  is_active?: boolean;
}) {
  const existing = await prisma.user.findUnique({ where: { kommoId: u.id } });
  return prisma.user.upsert({
    where: { kommoId: u.id },
    create: {
      kommoId: u.id,
      name: u.name,
      email: u.email || null,
      isActive: u.is_active ?? true,
      role: "agent",
    },
    update: {
      name: u.name,
      // No sobrescribir email/password/role locales si ya se configuraron
      email: existing?.email || u.email || null,
      isActive: u.is_active ?? true,
    },
  });
}

export async function upsertCompany(c: KommoCompany) {
  const responsible = c.responsible_user_id
    ? await prisma.user.findUnique({ where: { kommoId: c.responsible_user_id } })
    : null;

  return prisma.company.upsert({
    where: { kommoId: c.id },
    create: {
      kommoId: c.id,
      name: c.name,
      responsibleId: responsible?.id,
      customFields: customFieldsToJson(c.custom_fields_values),
      kommoCreatedAt: ts(c.created_at),
      kommoUpdatedAt: ts(c.updated_at),
      deletedAt: null,
    },
    update: {
      name: c.name,
      responsibleId: responsible?.id,
      customFields: customFieldsToJson(c.custom_fields_values),
      kommoCreatedAt: ts(c.created_at),
      kommoUpdatedAt: ts(c.updated_at),
      deletedAt: null,
    },
  });
}

export async function upsertContact(c: KommoContact) {
  const { phone, email } = extractPhoneEmail(c.custom_fields_values);
  const responsible = c.responsible_user_id
    ? await prisma.user.findUnique({ where: { kommoId: c.responsible_user_id } })
    : null;
  const companyKommoId = c._embedded?.companies?.[0]?.id;
  const company = companyKommoId
    ? await prisma.company.findUnique({ where: { kommoId: companyKommoId } })
    : null;

  for (const tag of c._embedded?.tags || []) {
    await prisma.tag.upsert({
      where: { name_entityType: { name: tag.name, entityType: "contacts" } },
      create: { kommoId: tag.id, name: tag.name, entityType: "contacts" },
      update: { kommoId: tag.id },
    });
  }

  return prisma.contact.upsert({
    where: { kommoId: c.id },
    create: {
      kommoId: c.id,
      name: c.name,
      firstName: c.first_name || null,
      lastName: c.last_name || null,
      phone,
      email,
      companyId: company?.id,
      responsibleId: responsible?.id,
      tags: tagsToJson(c._embedded?.tags),
      customFields: customFieldsToJson(c.custom_fields_values),
      kommoCreatedAt: ts(c.created_at),
      kommoUpdatedAt: ts(c.updated_at),
      deletedAt: null,
    },
    update: {
      name: c.name,
      firstName: c.first_name || null,
      lastName: c.last_name || null,
      phone,
      email,
      companyId: company?.id,
      responsibleId: responsible?.id,
      tags: tagsToJson(c._embedded?.tags),
      customFields: customFieldsToJson(c.custom_fields_values),
      kommoCreatedAt: ts(c.created_at),
      kommoUpdatedAt: ts(c.updated_at),
      deletedAt: null,
    },
  });
}

export async function upsertLead(l: KommoLead) {
  const pipeline = l.pipeline_id
    ? await prisma.pipeline.findUnique({ where: { kommoId: l.pipeline_id } })
    : null;
  const stage = l.status_id
    ? await prisma.stage.findUnique({ where: { kommoId: l.status_id } })
    : null;
  const responsible = l.responsible_user_id
    ? await prisma.user.findUnique({ where: { kommoId: l.responsible_user_id } })
    : null;
  const companyKommoId = l._embedded?.companies?.[0]?.id;
  const company = companyKommoId
    ? await prisma.company.findUnique({ where: { kommoId: companyKommoId } })
    : null;

  let status = "active";
  if (stage?.isWon) status = "won";
  if (stage?.isLost) status = "lost";

  for (const tag of l._embedded?.tags || []) {
    await prisma.tag.upsert({
      where: { name_entityType: { name: tag.name, entityType: "leads" } },
      create: {
        kommoId: tag.id,
        name: tag.name,
        entityType: "leads",
        color: tag.color || null,
      },
      update: { kommoId: tag.id, color: tag.color || null },
    });
  }

  const existing = await prisma.lead.findUnique({ where: { kommoId: l.id } });
  const keepCrmOwner = Boolean(existing?.crmAssigned);

  let lead = await prisma.lead.upsert({
    where: { kommoId: l.id },
    create: {
      kommoId: l.id,
      name: l.name,
      price: l.price || 0,
      status,
      pipelineId: pipeline?.id,
      stageId: stage?.id,
      responsibleId: responsible?.id,
      companyId: company?.id,
      source: l._embedded?.source?.name || null,
      tags: tagsToJson(l._embedded?.tags),
      customFields: customFieldsToJson(l.custom_fields_values),
      lossReason: l.loss_reason?.name || null,
      crmAssigned: false,
      kommoCreatedAt: ts(l.created_at),
      kommoUpdatedAt: ts(l.updated_at),
      deletedAt: null,
    },
    update: {
      name: l.name,
      price: l.price || 0,
      status,
      pipelineId: pipeline?.id,
      stageId: stage?.id,
      // No pisar el asesor si ConexiónCRM ya lo repartió
      ...(keepCrmOwner ? {} : { responsibleId: responsible?.id }),
      companyId: company?.id,
      source: l._embedded?.source?.name || null,
      tags: tagsToJson(l._embedded?.tags),
      customFields: customFieldsToJson(l.custom_fields_values),
      lossReason: l.loss_reason?.name || null,
      kommoCreatedAt: ts(l.created_at),
      kommoUpdatedAt: ts(l.updated_at),
      deletedAt: null,
    },
  });

  // Relación lead-contactos (traer contacto si aún no está local)
  const contacts = l._embedded?.contacts || [];
  let primaryContactName: string | null = null;
  for (const c of contacts) {
    let contact = await prisma.contact.findUnique({ where: { kommoId: c.id } });
    if (!contact) {
      try {
        const remote = await kommoApi.getContact(c.id);
        contact = await upsertContact(remote);
      } catch {
        contact = null;
      }
    }
    if (!contact) continue;
    if (c.is_main || !primaryContactName) primaryContactName = contact.name;
    await prisma.leadContact.upsert({
      where: { leadId_contactId: { leadId: lead.id, contactId: contact.id } },
      create: {
        leadId: lead.id,
        contactId: contact.id,
        isPrimary: Boolean(c.is_main),
      },
      update: { isPrimary: Boolean(c.is_main) },
    });
  }

  // Si Kommo puso "Lead #123", preferir el nombre del contacto principal
  const genericName = /^lead\s*#?\s*\d+$/i.test(l.name.trim());
  if (primaryContactName && genericName) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { name: primaryContactName },
    });
    lead = { ...lead, name: primaryContactName };
  }

  // Lead nuevo → round-robin local (no requiere licencia Kommo extra)
  if (!existing) {
    const { autoAssignNewLead } = await import("@/lib/assignment");
    const assigned = await autoAssignNewLead(lead.id);
    return assigned || lead;
  }

  return lead;
}

export async function upsertTask(t: KommoTask) {
  const responsible = t.responsible_user_id
    ? await prisma.user.findUnique({ where: { kommoId: t.responsible_user_id } })
    : null;

  let leadId: string | null = null;
  if (t.entity_type === "leads" && t.entity_id) {
    const lead = await prisma.lead.findUnique({ where: { kommoId: t.entity_id } });
    leadId = lead?.id || null;
  }

  return prisma.task.upsert({
    where: { kommoId: t.id },
    create: {
      kommoId: t.id,
      text: t.text || null,
      entityType: t.entity_type || null,
      leadId,
      responsibleId: responsible?.id,
      isCompleted: Boolean(t.is_completed),
      completeTill: ts(t.complete_till),
      taskTypeId: t.task_type_id || null,
      kommoCreatedAt: ts(t.created_at),
      kommoUpdatedAt: ts(t.updated_at),
    },
    update: {
      text: t.text || null,
      entityType: t.entity_type || null,
      leadId,
      responsibleId: responsible?.id,
      isCompleted: Boolean(t.is_completed),
      completeTill: ts(t.complete_till),
      taskTypeId: t.task_type_id || null,
      kommoCreatedAt: ts(t.created_at),
      kommoUpdatedAt: ts(t.updated_at),
    },
  });
}

export async function upsertNote(
  n: KommoNote,
  entityType: "leads" | "contacts" | "companies",
) {
  let leadId: string | null = null;
  let contactId: string | null = null;

  if (entityType === "leads") {
    const lead = await prisma.lead.findUnique({ where: { kommoId: n.entity_id } });
    leadId = lead?.id || null;
  }
  if (entityType === "contacts") {
    const contact = await prisma.contact.findUnique({ where: { kommoId: n.entity_id } });
    contactId = contact?.id || null;
  }

  return prisma.note.upsert({
    where: { kommoId: n.id },
    create: {
      kommoId: n.id,
      entityType: entityType.replace(/s$/, ""),
      leadId,
      contactId,
      noteType: n.note_type || null,
      text: n.params?.text || null,
      params: n.params ? JSON.stringify(n.params) : null,
      kommoCreatedAt: ts(n.created_at),
    },
    update: {
      entityType: entityType.replace(/s$/, ""),
      leadId,
      contactId,
      noteType: n.note_type || null,
      text: n.params?.text || null,
      params: n.params ? JSON.stringify(n.params) : null,
      kommoCreatedAt: ts(n.created_at),
    },
  });
}

export async function syncPipelines() {
  const data = await kommoApi.getPipelines();
  const pipelines = data._embedded?.pipelines || [];

  for (const p of pipelines) {
    const pipeline = await prisma.pipeline.upsert({
      where: { kommoId: p.id },
      create: {
        kommoId: p.id,
        name: p.name,
        isMain: p.is_main,
        sort: p.sort,
      },
      update: {
        name: p.name,
        isMain: p.is_main,
        sort: p.sort,
      },
    });

    for (const s of p._embedded?.statuses || []) {
      // type 1 = won, type 2 = lost en Kommo/amoCRM
      await prisma.stage.upsert({
        where: { kommoId: s.id },
        create: {
          kommoId: s.id,
          pipelineId: pipeline.id,
          name: s.name,
          sort: s.sort,
          color: s.color || null,
          isWon: s.type === 1,
          isLost: s.type === 2,
        },
        update: {
          pipelineId: pipeline.id,
          name: s.name,
          sort: s.sort,
          color: s.color || null,
          isWon: s.type === 1,
          isLost: s.type === 2,
        },
      });
    }
  }

  return pipelines.length;
}

export async function syncCustomFields() {
  let count = 0;
  for (const entityType of ["leads", "contacts", "companies"] as const) {
    const fields = await kommoApi.getCustomFields(entityType);
    for (const f of fields) {
      await prisma.customField.upsert({
        where: { kommoId: f.id },
        create: {
          kommoId: f.id,
          name: f.name,
          entityType,
          fieldType: f.type,
          code: f.code || null,
          enums: f.enums ? JSON.stringify(f.enums) : null,
        },
        update: {
          name: f.name,
          entityType,
          fieldType: f.type,
          code: f.code || null,
          enums: f.enums ? JSON.stringify(f.enums) : null,
        },
      });
      count += 1;
    }
  }
  return count;
}

/**
 * Migración completa por lotes respetando rate limit.
 * Orden: usuarios → embudos → campos → empresas → contactos → leads → tareas → notas
 */
export async function runFullMigration(jobId: string) {
  try {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date(), message: "Iniciando migración..." },
    });

    await updateJob(jobId, { message: "Sincronizando asesores...", progress: 5 });
    const users = await kommoApi.getUsers();
    for (const u of users) await upsertUser(u);

    await updateJob(jobId, { message: "Sincronizando embudos y etapas...", progress: 15 });
    await syncPipelines();

    await updateJob(jobId, { message: "Sincronizando campos personalizados...", progress: 20 });
    await syncCustomFields();

    await updateJob(jobId, { message: "Sincronizando empresas...", progress: 30 });
    let companies = 0;
    await kommoApi.getCompanies(async (items) => {
      for (const c of items) {
        await upsertCompany(c);
        companies += 1;
      }
      await updateJob(jobId, {
        message: `Empresas: ${companies}`,
        progress: 30 + Math.min(10, Math.floor(companies / 50)),
      });
    });

    await updateJob(jobId, { message: "Sincronizando contactos...", progress: 45 });
    let contacts = 0;
    await kommoApi.getContacts(async (items) => {
      for (const c of items) {
        await upsertContact(c);
        contacts += 1;
      }
      await updateJob(jobId, { message: `Contactos: ${contacts}`, progress: 45 });
    });

    await updateJob(jobId, { message: "Sincronizando leads...", progress: 60 });
    let leads = 0;
    await kommoApi.getLeads(async (items) => {
      for (const l of items) {
        await upsertLead(l);
        leads += 1;
      }
      await updateJob(jobId, { message: `Leads: ${leads}`, progress: 60 });
    });

    await updateJob(jobId, { message: "Sincronizando tareas...", progress: 80 });
    let tasks = 0;
    await kommoApi.getTasks(async (items) => {
      for (const t of items) {
        await upsertTask(t);
        tasks += 1;
      }
    });

    await updateJob(jobId, { message: "Sincronizando notas...", progress: 90 });
    let notes = 0;
    for (const entity of ["leads", "contacts"] as const) {
      await kommoApi.getNotes(entity, async (items) => {
        for (const n of items) {
          await upsertNote(n, entity);
          notes += 1;
        }
      });
    }

    await updateJob(jobId, {
      status: "completed",
      progress: 100,
      total: users.length + companies + contacts + leads + tasks + notes,
      message: `Migración completa: ${users.length} asesores, ${companies} empresas, ${contacts} contactos, ${leads} leads, ${tasks} tareas, ${notes} notas`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await updateJob(jobId, { status: "failed", message });
    throw error;
  }
}

export async function softDeleteLead(kommoId: number) {
  await prisma.lead.updateMany({
    where: { kommoId },
    data: { status: "deleted", deletedAt: new Date() },
  });
}

export async function restoreLead(kommoId: number) {
  const remote = await kommoApi.getLead(kommoId);
  return upsertLead(remote);
}
