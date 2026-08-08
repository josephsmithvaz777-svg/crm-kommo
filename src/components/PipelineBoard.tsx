"use client";

import { useEffect, useMemo, useState } from "react";

type Stage = {
  id: string;
  name: string;
  color: string | null;
  sort: number;
  isWon: boolean;
  isLost: boolean;
};

type Pipeline = {
  id: string;
  name: string;
  isMain: boolean;
  stages: Stage[];
};

type Lead = {
  id: string;
  name: string;
  price: number;
  stageId: string | null;
  responsible: { name: string } | null;
  source: string | null;
};

export function PipelineBoard() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/pipelines")
      .then((r) => r.json())
      .then((data) => {
        setPipelines(data.pipelines || []);
        const main =
          data.pipelines?.find((p: Pipeline) => p.isMain) || data.pipelines?.[0];
        if (main) setPipelineId(main.id);
      });
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    fetch(`/api/leads?pipelineId=${pipelineId}`)
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []));
  }, [pipelineId]);

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId),
    [pipelines, pipelineId],
  );

  const stages = [...(pipeline?.stages || [])].sort((a, b) => a.sort - b.sort);

  async function moveLead(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;

    const prev = lead.stageId;
    setLeads((list) => list.map((l) => (l.id === leadId ? { ...l, stageId } : l)));
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, pipelineId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo mover el lead");
      if (data.warning) setError(data.warning);
      if (data.lead?.stageId) {
        setLeads((list) =>
          list.map((l) =>
            l.id === leadId ? { ...l, stageId: data.lead.stageId } : l,
          ),
        );
      }
    } catch (e) {
      setLeads((list) => list.map((l) => (l.id === leadId ? { ...l, stageId: prev } : l)));
      setError(e instanceof Error ? e.message : "Error al mover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--muted)]">Embudo</label>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isMain ? " (principal)" : ""}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Arrastra tarjetas entre columnas · el cambio se guarda en Kommo
          {busy ? " · guardando..." : ""}
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {!pipelines.length && (
        <p className="text-sm text-[var(--muted)]">
          Sin embudos. Conecta Kommo y ejecuta la migración.
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const columnLeads = leads.filter((l) => l.stageId === stage.id);
          const isOver = overStageId === stage.id;
          return (
            <div
              key={stage.id}
              className={`min-w-[240px] flex-1 rounded-xl border bg-[var(--panel)] transition ${
                isOver ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30" : "border-[var(--line)]"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStageId(stage.id);
              }}
              onDragLeave={() => setOverStageId((id) => (id === stage.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                const leadId = e.dataTransfer.getData("text/lead-id") || draggingId;
                setOverStageId(null);
                setDraggingId(null);
                if (leadId) void moveLead(leadId, stage.id);
              }}
            >
              <div
                className="flex items-center justify-between border-b border-[var(--line)] px-3 py-3"
                style={{ borderTop: `3px solid ${stage.color || "var(--accent)"}` }}
              >
                <h3 className="text-sm font-medium text-[var(--ink)]">
                  {stage.name}
                  {stage.isWon ? " ✓" : ""}
                  {stage.isLost ? " ✕" : ""}
                </h3>
                <span className="text-xs text-[var(--muted)]">{columnLeads.length}</span>
              </div>
              <div className="min-h-[120px] space-y-2 p-3">
                {columnLeads.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(lead.id);
                      e.dataTransfer.setData("text/lead-id", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStageId(null);
                    }}
                    className={`cursor-grab rounded-lg border border-[var(--line)] bg-[var(--sand)]/50 p-3 active:cursor-grabbing ${
                      draggingId === lead.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--ink)]">{lead.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {lead.responsible?.name || "Sin asesor"}
                      {lead.source ? ` · ${lead.source}` : ""}
                    </p>
                    {lead.price > 0 && (
                      <p className="mt-2 text-sm text-[var(--accent)]">
                        ${lead.price.toLocaleString("es-MX")}
                      </p>
                    )}
                    <label className="mt-2 block text-[10px] text-[var(--muted)]">
                      Mover a
                      <select
                        className="mt-0.5 w-full rounded border border-[var(--line)] bg-white px-1 py-1 text-xs text-[var(--ink)]"
                        value={lead.stageId || ""}
                        onChange={(e) => {
                          if (e.target.value) void moveLead(lead.id, e.target.value);
                        }}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
                {!columnLeads.length && (
                  <p className="px-1 py-6 text-center text-xs text-[var(--muted)]">
                    Suelta aquí
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
