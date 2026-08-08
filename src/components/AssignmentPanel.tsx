"use client";

import { useEffect, useState } from "react";

type Candidate = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  inAssignPool: boolean;
  _count: { leads: number };
};

export function AssignmentPanel() {
  const [autoAssign, setAutoAssign] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [poolSize, setPoolSize] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/assignment");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cargar");
      return;
    }
    setAutoAssign(Boolean(data.autoAssign));
    setCandidates(data.candidates || []);
    setPoolSize((data.pool || []).length);
    setError(null);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleAuto(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAssign: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setAutoAssign(Boolean(data.autoAssign));
      setPoolSize((data.pool || []).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePool(userId: string, inAssignPool: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, inAssignPool }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setCandidates(data.candidates || []);
      setPoolSize((data.pool || []).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function redistribute(forceAll: boolean) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMessage(data.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          Reparto de leads
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Round-robin local entre asesores con login. No consume licencias extra de Kommo: el
          responsable en Kommo puede seguir siendo el admin; en ConexiónCRM cada asesor ve los
          suyos.
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          checked={autoAssign}
          disabled={busy}
          onChange={(e) => toggleAuto(e.target.checked)}
        />
        Asignar automáticamente leads nuevos ({poolSize} en el pool)
      </label>

      <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">En pool</th>
              <th className="px-3 py-2">Asesor</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Leads</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)]/60">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={u.inAssignPool}
                    disabled={busy}
                    onChange={(e) => togglePool(u.id, e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2 font-medium">
                  {u.name}{" "}
                  <span className="text-xs text-[var(--muted)]">({u.role})</span>
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">{u.email || "—"}</td>
                <td className="px-3 py-2">{u._count.leads}</td>
              </tr>
            ))}
            {!candidates.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                  Primero crea contraseñas en Equipo para los asesores que recibirán leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !poolSize}
          onClick={() => redistribute(false)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Repartir leads sin asignación CRM
        </button>
        <button
          type="button"
          disabled={busy || !poolSize}
          onClick={() => {
            if (confirm("¿Redistribuir TODOS los leads activos entre el pool?")) {
              redistribute(true);
            }
          }}
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink)] disabled:opacity-40"
        >
          Redistribuir todos
        </button>
      </div>

      {message && <p className="text-sm text-emerald-800">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
