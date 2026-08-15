"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
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
        silent: true, // el beep lo hace la app
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
          href: n.href || undefined,
        },
        !played,
      );
      played = true;
      browserNotify(n.title, n.body || undefined, n.href || undefined);
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
        false, // el sonido ya lo disparó emitCrmAlert
      );
      browserNotify(detail.title, detail.body, detail.href);
      void load();
    };
    window.addEventListener("crm:alert", onAlert);

    load();
    const a = setInterval(load, 4000);
    const b = setInterval(watchInbox, 6000);
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
    if (next) playAlertSound();
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await load();
  }

  async function openItem(n: Notif) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    });
    setOpen(false);
    if (n.href) window.location.href = n.href;
    else await load();
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative rounded-md px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--sand)] hover:text-[var(--ink)]"
          aria-label="Notificaciones"
        >
          Alertas
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
              <p className="text-sm font-medium text-[var(--ink)]">Notificaciones</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleSound}
                  className="text-[10px] text-[var(--muted)] underline"
                  title={soundOn ? "Silenciar" : "Activar sonido"}
                >
                  {soundOn ? "Sonido" : "Mute"}
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
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={`block w-full border-b border-[var(--line)]/60 px-3 py-2 text-left hover:bg-[var(--sand)]/50 ${
                    n.readAt ? "opacity-60" : ""
                  }`}
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
              <Link href={t.href} className="mt-2 inline-block text-xs text-[var(--accent)] underline">
                Abrir
              </Link>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
