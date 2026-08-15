"use client";

import { useEffect, useRef, useState } from "react";
import { emitCrmAlert, unlockAlertAudio } from "@/lib/alert-sound";

type Talk = {
  talk_id: number;
  origin?: string;
  status?: string;
  is_in_work?: boolean;
  updated_at?: number;
  created_at?: number;
};

type InboxItem = {
  talk: Talk;
  lead: { id: string; name: string; phone?: string | null; kommoId: number };
};

type Message = {
  id: string;
  type?: string;
  text?: string;
  created_at?: number;
  origin?: string;
  author?: { name?: string; type?: string };
  attachment?: { type?: string; link?: string; file_name?: string } | null;
};

type LeadOption = { id: string; name: string; phone?: string | null; kommoId: number };

/** Kommo usa unix seconds */
function fromUnix(ts?: number | null) {
  if (!ts || !Number.isFinite(ts)) return null;
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms);
}

function formatMessageTime(ts?: number | null) {
  const d = fromUnix(ts);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function formatInboxTime(ts?: number | null) {
  const d = fromUnix(ts);
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.toLocaleDateString("es-PE", { timeZone: "America/Lima" }) ===
    now.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
  if (sameDay) {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  }
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function sortMessagesAsc(list: Message[]) {
  return [...list].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
}

function dayKey(ts?: number | null) {
  const d = fromUnix(ts);
  if (!d) return "";
  return d.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ChatWorkspace() {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [talks, setTalks] = useState<Talk[]>([]);
  const [talkId, setTalkId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const talkIdRef = useRef<number | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const selectedLeadIdRef = useRef("");
  const inboxRef = useRef<InboxItem[]>([]);
  const leadsRef = useRef<LeadOption[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    talkIdRef.current = talkId;
  }, [talkId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);

  useEffect(() => {
    inboxRef.current = inbox;
  }, [inbox]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    const unlock = () => unlockAlertAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  async function loadInbox() {
    const res = await fetch("/api/chat");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cargar el inbox");
      return;
    }
    const items = (data.inbox || []) as InboxItem[];
    items.sort((a, b) => (b.talk.updated_at || 0) - (a.talk.updated_at || 0));
    setInbox(items);
    setLeads(data.leads || []);
    setError(null);
  }

  async function refreshMessages(silent = true) {
    const id = talkIdRef.current;
    if (!id) return;
    const res = await fetch(`/api/chat?talkId=${id}`);
    const data = await res.json();
    if (!res.ok) {
      if (!silent) {
        setError(
          data.error ||
            "No se pudieron cargar mensajes (revisa permisos External chat history en Kommo)",
        );
      }
      return;
    }
    const next = sortMessagesAsc(data.messages || []);
    const prev = messagesRef.current;
    if (prev.length > 0) {
      const prevIds = new Set(prev.map((m) => m.id));
      const realIncoming = next.filter(
        (m) => !prevIds.has(m.id) && m.type === "incoming",
      );
      if (realIncoming.length > 0) {
        const last = realIncoming[realIncoming.length - 1];
        const leadId = selectedLeadIdRef.current;
        const leadName =
          inboxRef.current.find((i) => i.talk.talk_id === id)?.lead.name ||
          leadsRef.current.find((l) => l.id === leadId)?.name ||
          "Chat";
        emitCrmAlert({
          title: `Nuevo mensaje · ${leadName}`,
          body: last.text || "Mensaje nuevo",
          href: leadId ? `/chat?leadId=${leadId}` : "/chat",
        });
        if (leadId) {
          void fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "message",
              leadId,
              body: last.text || `Nuevo mensaje de ${leadName}`,
            }),
          });
        }
      }
    }
    setMessages(next);
    if (!silent) setError(null);
    setLive(true);
  }

  useEffect(() => {
    loadInbox();
    const inboxTimer = setInterval(loadInbox, 8000);
    return () => clearInterval(inboxTimer);
  }, []);

  useEffect(() => {
    if (!talkId) {
      setLive(false);
      return;
    }
    stickToBottom.current = true;
    messagesRef.current = [];
    void refreshMessages(false);
    const msgTimer = setInterval(() => void refreshMessages(true), 3000);
    return () => clearInterval(msgTimer);
  }, [talkId]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get("leadId");
    if (leadId) void openLead(leadId);
  }, []);

  async function openLead(leadId: string) {
    setSelectedLeadId(leadId);
    setTalkId(null);
    setMessages([]);
    const res = await fetch(`/api/chat?leadId=${leadId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sin conversaciones");
      setTalks([]);
      return;
    }
    const nextTalks = (data.talks || []) as Talk[];
    nextTalks.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    setTalks(nextTalks);
    if (nextTalks[0]) {
      setTalkId(nextTalks[0].talk_id);
    }
  }

  async function openTalk(id: number, leadId = selectedLeadId) {
    setTalkId(id);
    setSelectedLeadId(leadId);
  }

  async function send() {
    if (!talkId || !text.trim()) return;
    setBusy(true);
    setError(null);
    stickToBottom.current = true;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talkId, text, leadId: selectedLeadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar");
      setText("");
      await refreshMessages(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  let lastDay = "";
  const selectedLead =
    inbox.find((i) => i.talk.talk_id === talkId)?.lead ||
    leads.find((l) => l.id === selectedLeadId) ||
    null;

  return (
    <div className="grid h-[calc(100dvh-7.5rem)] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="shrink-0 border-b border-[var(--line)] px-3 py-3">
          <h2 className="text-sm font-medium text-[var(--ink)]">Conversaciones</h2>
          <p className="text-xs text-[var(--muted)]">
            En vivo desde Kommo · no hace falta migrar
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {inbox.map((item) => (
            <button
              key={`${item.talk.talk_id}-${item.lead.id}`}
              type="button"
              onClick={() => openTalk(item.talk.talk_id, item.lead.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                talkId === item.talk.talk_id ? "bg-[var(--sand)]" : "hover:bg-[var(--sand)]/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-[var(--ink)]">{item.lead.name}</p>
                <span className="shrink-0 text-[10px] text-[var(--muted)]">
                  {formatInboxTime(item.talk.updated_at || item.talk.created_at)}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {item.lead.phone || item.talk.origin || "canal"}
                {` · #${item.lead.kommoId}`}
              </p>
            </button>
          ))}
          {!inbox.length && (
            <p className="px-2 py-6 text-center text-xs text-[var(--muted)]">
              Sin chats abiertos. Elige un lead abajo.
            </p>
          )}
        </div>
        <div className="shrink-0 border-t border-[var(--line)] p-3">
          <label className="text-xs text-[var(--muted)]">Abrir chat de lead</label>
          <select
            value={selectedLeadId}
            onChange={(e) => e.target.value && openLead(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-2 py-2 text-sm"
          >
            <option value="">Seleccionar lead...</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.phone ? ` · ${l.phone}` : ""}
              </option>
            ))}
          </select>
          {talks.length > 1 && (
            <select
              value={talkId ?? ""}
              onChange={(e) => openTalk(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-2 py-2 text-sm"
            >
              {talks.map((t) => (
                <option key={t.talk_id} value={t.talk_id}>
                  {t.origin || "chat"} #{t.talk_id}
                  {t.updated_at ? ` · ${formatInboxTime(t.updated_at)}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                {selectedLead?.name || (talkId ? `Chat #${talkId}` : "Mensajes")}
              </h2>
              {selectedLead && (
                <p className="text-xs text-[var(--muted)]">
                  {selectedLead.phone ? `${selectedLead.phone} · ` : ""}
                  Lead #{selectedLead.kommoId}
                  {talkId ? ` · chat #${talkId}` : ""}
                </p>
              )}
            </div>
            {talkId && live && (
              <span className="text-[10px] uppercase tracking-wide text-emerald-700">
                Actualizando cada 3s
              </span>
            )}
          </div>
          {!selectedLead && (
            <p className="text-xs text-[var(--muted)]">
              Orden cronológico · hora Perú (America/Lima)
            </p>
          )}
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          onScroll={() => {
            const el = listRef.current;
            if (!el) return;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {messages.map((m) => {
            const mine = m.type === "outgoing";
            const day = dayKey(m.created_at);
            const showDay = day && day !== lastDay;
            if (showDay) lastDay = day;
            return (
              <div key={m.id}>
                {showDay && (
                  <p className="mb-3 mt-1 text-center text-[11px] capitalize text-[var(--muted)]">
                    {day}
                  </p>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--sand)] text-[var(--ink)]"
                    }`}
                  >
                    <p className="text-[10px] opacity-70">
                      {m.author?.name || (mine ? "Tú" : "Cliente")}
                      {m.origin ? ` · ${m.origin}` : ""}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">
                      {m.text || (m.attachment ? `[${m.attachment.type}]` : "")}
                    </p>
                    {m.created_at ? (
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-[var(--muted)]"}`}>
                        {formatMessageTime(m.created_at)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
          {!messages.length && (
            <p className="py-16 text-center text-sm text-[var(--muted)]">
              Selecciona una conversación para ver el historial.
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--line)] bg-[var(--panel)] p-3">
          {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              disabled={!talkId || busy}
              placeholder={talkId ? "Escribe un mensaje..." : "Elige un chat primero"}
              className="flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={!talkId || busy || !text.trim()}
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
