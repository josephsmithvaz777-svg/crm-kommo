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

  const stages = (pipeline?.stages || []).filter((s) => !s.isWon && !s.isLost);

  return (
    <div className="space-y-4">
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

      {!pipelines.length && (
        <p className="text-sm text-[var(--muted)]">
          Sin embudos. Conecta Kommo y ejecuta la migración.
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const columnLeads = leads.filter((l) => l.stageId === stage.id);
          return (
            <div
              key={stage.id}
              className="min-w-[240px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel)]"
            >
              <div
                className="flex items-center justify-between border-b border-[var(--line)] px-3 py-3"
                style={{ borderTop: `3px solid ${stage.color || "var(--accent)"}` }}
              >
                <h3 className="text-sm font-medium text-[var(--ink)]">{stage.name}</h3>
                <span className="text-xs text-[var(--muted)]">{columnLeads.length}</span>
              </div>
              <div className="space-y-2 p-3">
                {columnLeads.map((lead) => (
                  <article
                    key={lead.id}
                    className="rounded-lg border border-[var(--line)] bg-[var(--sand)]/50 p-3"
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
                  </article>
                ))}
                {!columnLeads.length && (
                  <p className="px-1 py-6 text-center text-xs text-[var(--muted)]">Vacío</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
