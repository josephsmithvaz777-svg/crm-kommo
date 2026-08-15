"use client";

import { useEffect, useRef, useState } from "react";

type Talk = {
  talk_id: number;
  origin?: string;
  status?: string;
  is_in_work?: boolean;
  updated_at?: number;
};

type InboxItem = {
  talk: Talk;
  lead: { id: string; name: string; kommoId: number };
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

type LeadOption = { id: string; name: string; kommoId: number };

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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    talkIdRef.current = talkId;
  }, [talkId]);

  async function loadInbox() {
    const res = await fetch("/api/chat");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cargar el inbox");
      return;
    }
    setInbox(data.inbox || []);
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
    setMessages(data.messages || []);
    if (!silent) setError(null);
    setLive(true);
  }

  useEffect(() => {
    loadInbox();
    const inboxTimer = setInterval(loadInbox, 8000);
    return () => clearInterval(inboxTimer);
  }, []);

  // Mensajes en vivo desde Kommo (sin migración)
  useEffect(() => {
    if (!talkId) {
      setLive(false);
      return;
    }
    void refreshMessages(false);
    const msgTimer = setInterval(() => void refreshMessages(true), 3000);
    return () => clearInterval(msgTimer);
  }, [talkId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
    setTalks(data.talks || []);
    if (data.talks?.[0]) {
      setTalkId(data.talks[0].talk_id);
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
              <p className="font-medium text-[var(--ink)]">{item.lead.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {item.talk.origin || "canal"} · #{item.talk.talk_id}
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
                </option>
              ))}
            </select>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="shrink-0 border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              {talkId ? `Chat #${talkId}` : "Mensajes"}
            </h2>
            {talkId && live && (
              <span className="text-[10px] uppercase tracking-wide text-emerald-700">
                Actualizando cada 3s
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted)]">
            WhatsApp / Instagram / Facebook según canales en Kommo. La migración completa solo es
            para la carga inicial de leads.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m) => {
            const mine = m.type === "outgoing";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
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
