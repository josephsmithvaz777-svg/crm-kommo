import { getValidAccessToken } from "./oauth";
import { kommoBaseUrl } from "./config";
import { kommoRateLimiter } from "./rate-limiter";

export type KommoListResponse<T> = {
  _embedded?: T;
  _links?: { next?: { href: string } };
  _page?: number;
  _page_count?: number;
};

async function kommoFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  await kommoRateLimiter.wait();
  const token = await getValidAccessToken();
  const url = path.startsWith("http") ? path : `${kommoBaseUrl()}/api/v4${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) {
    return {} as T;
  }

  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 1500));
    return kommoFetch<T>(path, options, false);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kommo API ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

export async function fetchAllPages<TItem>(
  path: string,
  embeddedKey: string,
  pageLimit = 250,
  onPage?: (items: TItem[], page: number) => Promise<void> | void,
): Promise<TItem[]> {
  const all: TItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const separator = path.includes("?") ? "&" : "?";
    const data = await kommoFetch<KommoListResponse<Record<string, TItem[]>>>(
      `${path}${separator}limit=${pageLimit}&page=${page}`,
    );
    const items = data._embedded?.[embeddedKey] || [];
    all.push(...items);
    if (onPage) await onPage(items, page);

    hasMore = items.length === pageLimit;
    page += 1;
  }

  return all;
}

export const kommoApi = {
  getAccount: () => kommoFetch<{ id: number; name: string; subdomain: string }>("/account"),

  getUsers: () =>
    fetchAllPages<{ id: number; name: string; email?: string; is_active?: boolean }>(
      "/users",
      "users",
    ),

  getPipelines: () =>
    kommoFetch<{
      _embedded?: {
        pipelines: Array<{
          id: number;
          name: string;
          is_main: boolean;
          sort: number;
          _embedded?: {
            statuses: Array<{
              id: number;
              name: string;
              sort: number;
              color?: string;
              type?: number;
            }>;
          };
        }>;
      };
    }>("/leads/pipelines"),

  getLeads: (onPage?: (items: KommoLead[], page: number) => Promise<void> | void) =>
    fetchAllPages<KommoLead>(
      "/leads?with=contacts,catalog_elements,loss_reason,source_id",
      "leads",
      250,
      onPage,
    ),

  getLead: (id: number) =>
    kommoFetch<KommoLead>(`/leads/${id}?with=contacts,loss_reason,source_id`),

  updateLead: (payload: {
    id: number;
    status_id?: number;
    pipeline_id?: number;
    name?: string;
    price?: number;
    responsible_user_id?: number;
  }) =>
    kommoFetch("/leads", {
      method: "PATCH",
      body: JSON.stringify([payload]),
    }),

  getContacts: (onPage?: (items: KommoContact[], page: number) => Promise<void> | void) =>
    fetchAllPages<KommoContact>("/contacts?with=leads", "contacts", 250, onPage),

  getContact: (id: number) => kommoFetch<KommoContact>(`/contacts/${id}`),

  getCompanies: (onPage?: (items: KommoCompany[], page: number) => Promise<void> | void) =>
    fetchAllPages<KommoCompany>("/companies", "companies", 250, onPage),

  getCompany: (id: number) => kommoFetch<KommoCompany>(`/companies/${id}`),

  getTasks: (onPage?: (items: KommoTask[], page: number) => Promise<void> | void) =>
    fetchAllPages<KommoTask>("/tasks", "tasks", 250, onPage),

  getTask: (id: number) => kommoFetch<KommoTask>(`/tasks/${id}`),

  getNotes: (
    entityType: "leads" | "contacts" | "companies",
    onPage?: (items: KommoNote[], page: number) => Promise<void> | void,
  ) => fetchAllPages<KommoNote>(`/${entityType}/notes`, "notes", 250, onPage),

  getCustomFields: (entityType: "leads" | "contacts" | "companies") =>
    fetchAllPages<{
      id: number;
      name: string;
      type: string;
      code?: string;
      enums?: Array<{ id: number; value: string }>;
    }>(`/${entityType}/custom_fields`, "custom_fields"),

  subscribeWebhook: (destination: string, settings: string[]) =>
    kommoFetch("/webhooks", {
      method: "POST",
      body: JSON.stringify([{ destination, settings }]),
    }),

  listWebhooks: () =>
    kommoFetch<{ _embedded?: { webhooks: Array<{ id: number; destination: string; settings: string[] }> } }>(
      "/webhooks",
    ),

  getTalks: (params?: {
    entityId?: number;
    contactId?: number;
    onlyInWork?: boolean;
  }) => {
    const q = new URLSearchParams();
    q.set("limit", "50");
    if (params?.entityId) {
      q.set("filter[entity_id][]", String(params.entityId));
      q.set("filter[entity_type]", "lead");
    }
    if (params?.contactId) q.set("filter[contact_id][]", String(params.contactId));
    if (params?.onlyInWork) q.set("filter[only_in_work]", "");
    return kommoFetch<{ _embedded?: { talks: KommoTalk[] } }>(`/talks?${q.toString()}`);
  },

  getTalkMessages: (talkId: number) =>
    kommoFetch<{ _embedded?: { messages: KommoTalkMessage[] } }>(
      `/talks/${talkId}/messages?limit=100`,
    ),

  sendTalkMessage: (talkId: number, text: string) =>
    kommoFetch<{ id: string }>(`/talks/${talkId}/send_message`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

export type KommoLead = {
  id: number;
  name: string;
  price?: number;
  status_id?: number;
  pipeline_id?: number;
  responsible_user_id?: number;
  created_at?: number;
  updated_at?: number;
  closed_at?: number | null;
  loss_reason?: { id: number; name: string };
  custom_fields_values?: Array<{
    field_id: number;
    field_name?: string;
    values: Array<{ value: string | number | boolean }>;
  }>;
  _embedded?: {
    tags?: Array<{ id: number; name: string; color?: string }>;
    contacts?: Array<{ id: number; is_main?: boolean }>;
    companies?: Array<{ id: number }>;
    source?: { id: number; name?: string };
  };
};

export type KommoContact = {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  responsible_user_id?: number;
  created_at?: number;
  updated_at?: number;
  custom_fields_values?: Array<{
    field_id: number;
    field_name?: string;
    field_code?: string;
    values: Array<{ value: string | number; enum_code?: string }>;
  }>;
  _embedded?: {
    tags?: Array<{ id: number; name: string }>;
    companies?: Array<{ id: number }>;
  };
};

export type KommoCompany = {
  id: number;
  name: string;
  responsible_user_id?: number;
  created_at?: number;
  updated_at?: number;
  custom_fields_values?: Array<{
    field_id: number;
    field_name?: string;
    values: Array<{ value: string | number }>;
  }>;
};

export type KommoTask = {
  id: number;
  text?: string;
  responsible_user_id?: number;
  entity_id?: number;
  entity_type?: string;
  is_completed?: boolean;
  complete_till?: number;
  task_type_id?: number;
  created_at?: number;
  updated_at?: number;
};

export type KommoNote = {
  id: number;
  entity_id: number;
  note_type?: string;
  created_at?: number;
  params?: { text?: string; [key: string]: unknown };
};

export type KommoTalk = {
  talk_id: number;
  contact_id?: number;
  chat_id?: string;
  entity_id?: number | null;
  entity_type?: string | null;
  status?: string;
  is_in_work?: boolean;
  is_read?: boolean;
  origin?: string;
  source_id?: number | null;
  updated_at?: number;
  created_at?: number;
};

export type KommoTalkMessage = {
  id: string;
  chat_id?: string;
  type?: "incoming" | "outgoing" | string;
  message_type?: string;
  text?: string;
  created_at?: number;
  origin?: string;
  delivery_status?: string;
  author?: {
    id?: string;
    type?: string;
    name?: string;
    user_id?: number;
  };
  attachment?: {
    type?: string;
    link?: string;
    file_name?: string;
  } | null;
};
