"use client";

import { useEffect, useState } from "react";

type Status = {
  configured: boolean;
  connected: boolean;
  subdomain: string | null;
  expiresAt: string | null;
  counts: Record<string, number>;
  lastJob: {
    id: string;
    status: string;
    progress: number;
    message: string | null;
  } | null;
  user?: { role: string; name: string } | null;
};

export function SyncPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");

  async function load() {
    const res = await fetch("/api/kommo/status");
    const data = await res.json();
    setStatus(data);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  async function startSync(force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sync${force ? "?force=1" : ""}`, { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        // Job colgado: cancelar y reintentar
        await fetch("/api/sync", { method: "DELETE" });
        const retry = await fetch("/api/sync?force=1", { method: "POST" });
        const retryData = await retry.json();
        if (!retry.ok) throw new Error(retryData.error || "No se pudo reiniciar");
        await load();
        return;
      }
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function registerWebhooks() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/webhooks/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Usa el dominio actual (Vercel) para no depender de un .env mal pegado
        body: JSON.stringify({ baseUrl: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron registrar webhooks");
      alert(`Webhooks registrados en:\n${data.destination}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function submitAuthCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kommo/oauth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Código inválido o expirado");
      setAuthCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return <p className="text-sm text-[var(--muted)]">Cargando estado Kommo...</p>;
  }

  const isAgent = status.user?.role === "agent";
  const agentCountKeys = ["leads", "contacts"];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(status.counts || {})
          .filter(([key]) => !isAgent || agentCountKeys.includes(key))
          .map(([key, value]) => (
          <div key={key} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{key}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {isAgent ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Hola, {status.user?.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Solo ves leads y contactos asignados a ti. Usa Embudos, Leads y Chat para trabajar.
          </p>
        </div>
      ) : (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Conexión Kommo
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {status.connected
                ? `Conectado a ${status.subdomain}.kommo.com · Chat y leads nuevos llegan por webhooks/API (no migres cada vez)`
                : status.configured
                  ? "Credenciales listas. Autoriza OAuth o pega el código."
                  : "Configura KOMMO_* en .env"}
            </p>
            {status.lastJob && (
              <p className="mt-3 text-sm text-[var(--ink)]">
                Último sync: <strong>{status.lastJob.status}</strong> — {status.lastJob.progress}%
                {status.lastJob.message ? ` · ${status.lastJob.message}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {status.configured && (
              <a
                href="/api/kommo/oauth/start"
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {status.connected ? "Reautorizar OAuth" : "Autorizar OAuth"}
              </a>
            )}
            {status.connected && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!confirm("¿Borrar tokens Kommo y volver a autorizar?")) return;
                  setBusy(true);
                  setError(null);
                  try {
                    const res = await fetch("/api/kommo/disconnect", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "No se pudo desconectar");
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800 disabled:opacity-40"
              >
                Desconectar tokens
              </button>
            )}
            <button
              type="button"
              disabled={!status.connected || busy}
              onClick={() => startSync(false)}
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Migración completa
            </button>
            {status.lastJob?.status === "running" && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await fetch("/api/sync", { method: "DELETE" });
                  await load();
                  setBusy(false);
                }}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800"
              >
                Cancelar sync
              </button>
            )}
            <button
              type="button"
              disabled={!status.connected || busy}
              onClick={registerWebhooks}
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] disabled:opacity-40"
            >
              Registrar webhooks
            </button>
          </div>
        </div>

        {status.configured && (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="text-sm text-[var(--muted)]">
              Si el token está revocado: usa <strong className="text-[var(--ink)]">Reautorizar OAuth</strong>{" "}
              o pega un código fresco de Kommo (válido 20 min).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                placeholder="def50200..."
                className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--sand)]/40 px-3 py-2 font-mono text-xs text-[var(--ink)]"
              />
              <button
                type="button"
                disabled={!authCode.trim() || busy}
                onClick={submitAuthCode}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Conectar con código
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {status.lastJob?.status === "running" && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--sand)]">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${status.lastJob.progress}%` }}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
