"use client";

import { useState } from "react";

type UserOpt = { id: string; name: string };

export function LeadAssignSelect({
  leadId,
  currentId,
  users,
}: {
  leadId: string;
  currentId: string | null;
  users: UserOpt[];
}) {
  const [value, setValue] = useState(currentId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: string) {
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibleId: next || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[160px] rounded border border-[var(--line)] bg-white px-1 py-1 text-xs"
      >
        <option value="">Sin asignar</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {error && <p className="text-[10px] text-red-700">{error}</p>}
    </div>
  );
}
