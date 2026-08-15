"use client";

import { useEffect, useRef, useState } from "react";
import {
  bumpUnread,
  isAlertSoundOn,
  playAlertSound,
  setAlertSoundOn,
  unlockAlertAudio,
  type CrmAlertDetail,
} from "@/lib/alert-sound";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  leadId: string | null;
  readAt: string | null;
  createdAt: string;
};

type Toast = { id: string; title: string; body?: string; href?: string };

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [browserOk, setBrowserOk] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());
  const talkSeen = useRef<Record<string, number>>({});
  const bootstrapped = useRef(false);

  useEffect(() => {
    // Forzar sonido ON si nunca se configuró (evita quedar en Mute sin querer)
    if (localStorage.getItem("crm_alert_sound") == null) {
      setAlertSoundOn(true);
    }
    setSoundOn(isAlertSoundOn());
  }, []);

  function pushToast(t: Omit<Toast, "id">, withSound = true) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    if (withSound) playAlertSound();
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 7000);
  }

  function browserNotify(title: string, body?: string, href?: string) {
    if (!browserOk || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, {
        body: body || "",
        tag: href || title,
        silent: true,
      });
      n.onclick = () => {
        window.focus();
        if (href) window.location.href = href;
        n.close();
      };
    } catch {
      // ignore
    }
  }

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.items || []) as Notif[];
    setItems(list);
    setUnread(data.unreadCount || 0);

    if (!bootstrapped.current) {
      for (const n of list) seenIds.current.add(n.id);
      bootstrapped.current = true;
      return;
    }

    let played = false;
    for (const n of list) {
      if (seenIds.current.has(n.id) || n.readAt) continue;
      seenIds.current.add(n.id);
      pushToast(
        {
          title: n.title,
          body: n.body || undefined,
          href: n.leadId ? `/chat?leadId=${n.leadId}` : n.href || undefined,
        },
        !played,
      );
      played = true;
      browserNotify(
        n.title,
        n.body || undefined,
        n.leadId ? `/chat?leadId=${n.leadId}` : n.href || undefined,
      );
    }
  }

  async function watchInbox() {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = await res.json();
      const inbox = (data.inbox || []) as Array<{
        talk: { talk_id: number; updated_at?: number };
        lead: { id: string; name: string };
      }>;

      for (const item of inbox) {
        const key = String(item.talk.talk_id);
        const updated = item.talk.updated_at || 0;
        const prev = talkSeen.current[key];
        if (prev === undefined) {
          talkSeen.current[key] = updated;
          continue;
        }
        if (updated > prev) {
          talkSeen.current[key] = updated;
          bumpUnread(item.talk.talk_id, 1);
          window.dispatchEvent(new Event("crm:unread"));
          playAlertSound();
          pushToast({
            title: `Nuevo mensaje · ${item.lead.name}`,
            body: "Nuevo mensaje en WhatsApp / chat",
            href: `/chat?leadId=${item.lead.id}`,
          }, false);
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "message",
              leadId: item.lead.id,
              body: `Nuevo mensaje de ${item.lead.name}`,
            }),
          });
          await load();
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") setBrowserOk(true);
    }

    const softUnlock = () => unlockAlertAudio();
    window.addEventListener("pointerdown", softUnlock, { once: true });

    const onAlert = (ev: Event) => {
      const detail = (ev as CustomEvent<CrmAlertDetail>).detail;
      if (!detail?.title) return;
      pushToast(
        {
          title: detail.title,
          body: detail.body,
          href: detail.href,
        },
        false,
      );
      browserNotify(detail.title, detail.body, detail.href);
      void load();
    };
    window.addEventListener("crm:alert", onAlert);

    load();
    const a = setInterval(load, 4000);
    const b = setInterval(watchInbox, 5000);
    return () => {
      clearInterval(a);
      clearInterval(b);
      window.removeEventListener("pointerdown", softUnlock);
      window.removeEventListener("crm:alert", onAlert);
    };
  }, []);

  async function enableBrowser() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserOk(perm === "granted");
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAlertSoundOn(next);
    if (next) {
      unlockAlertAudio();
      playAlertSound();
    }
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await load();
  }

  async function deleteOne(
    id: string,
    e?: { stopPropagation: () => void; preventDefault: () => void },
  ) {
    e?.stopPropagation();
    e?.preventDefault();
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    seenIds.current.delete(id);
    await load();
  }

  async function clearAll() {
    if (!confirm("¿Eliminar todas las notificaciones?")) return;
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    seenIds.current.clear();
    bootstrapped.current = false;
    await load();
  }

  async function openItem(n: Notif) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    });
    setOpen(false);
    // Siempre ir al chat del lead si hay leadId (aunque href viejo diga /leads)
    const href = n.leadId ? `/chat?leadId=${n.leadId}` : n.href;
    if (href) {
      window.location.assign(href);
      return;
    }
    await load();
  }

  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--sand)] hover:text-[var(--ink)]"
          aria-label="Notificaciones"
        >
          <span className="leading-none">Alertas</span>
          {unread > 0 ? (
            <span
              className="ml-2 inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-none text-white"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-[22rem] rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
              <p className="text-sm font-medium text-[var(--ink)]">Notificaciones</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`text-[10px] underline ${soundOn ? "text-emerald-700" : "text-red-700"}`}
                  title={soundOn ? "Sonido activado" : "Sonido silenciado — haz clic para activar"}
                >
                  {soundOn ? "Sonido" : "Silenciado"}
                </button>
                {!browserOk && (
                  <button
                    type="button"
                    onClick={enableBrowser}
                    className="text-[10px] text-[var(--accent)] underline"
                  >
                    Activar push
                  </button>
                )}
                <button
                  type="button"
                  onClick={markAll}
                  className="text-[10px] text-[var(--muted)] underline"
                >
                  Marcar leídas
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] text-red-700 underline"
                >
                  Limpiar todas
                </button>
              </div>
            </div>
            {!soundOn && (
              <p className="border-b border-[var(--line)] bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                El sonido está apagado. Pulsa <strong>Silenciado</strong> para activarlo.
              </p>
            )}
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2 border-b border-[var(--line)]/60 px-3 py-2 hover:bg-[var(--sand)]/50 ${
                    n.readAt ? "opacity-60" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm text-[var(--ink)]">{n.title}</p>
                    {n.body && <p className="text-xs text-[var(--muted)]">{n.body}</p>}
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                      {new Date(n.createdAt).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteOne(n.id, e)}
                    className="shrink-0 rounded px-2 py-1 text-[10px] text-red-700 hover:bg-red-50"
                    title="Eliminar notificación"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {!items.length && (
                <p className="px-3 py-8 text-center text-xs text-[var(--muted)]">
                  Sin notificaciones aún
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-lg"
          >
            <p className="text-sm font-medium text-[var(--ink)]">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-[var(--muted)]">{t.body}</p>}
            {t.href && (
              <a
                href={t.href}
                className="mt-2 inline-block text-xs text-[var(--accent)] underline"
              >
                Abrir chat
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
