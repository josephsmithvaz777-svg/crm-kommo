"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  hasPassword: boolean;
  kommoId: number;
  _count: { leads: number };
};

export function TeamPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sin acceso");
      return;
    }
    setUsers(data.users || []);
    setEmails(
      Object.fromEntries((data.users || []).map((u: UserRow) => [u.id, u.email || ""])),
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function save(userId: string, role?: string) {
    setError(null);
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        password: passwords[userId] || undefined,
        email: emails[userId],
        role,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo guardar");
      return;
    }
    setPasswords((p) => ({ ...p, [userId]: "" }));
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Tras la migración, los asesores de Kommo aparecen aquí. Asigna email + contraseña (máx. ~10
        usuarios activos).
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Asesor</th>
              <th className="px-3 py-2">Email login</th>
              <th className="px-3 py-2">Contraseña</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Leads</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)]/60">
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2">
                  <input
                    value={emails[u.id] || ""}
                    onChange={(e) => setEmails((x) => ({ ...x, [u.id]: e.target.value }))}
                    className="w-44 rounded border border-[var(--line)] px-2 py-1 text-xs"
                    placeholder="asesor@empresa.com"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="password"
                    value={passwords[u.id] || ""}
                    onChange={(e) => setPasswords((x) => ({ ...x, [u.id]: e.target.value }))}
                    className="w-36 rounded border border-[var(--line)] px-2 py-1 text-xs"
                    placeholder={u.hasPassword ? "•••••• (cambiar)" : "definir"}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    defaultValue={u.role}
                    onChange={(e) => save(u.id, e.target.value)}
                    className="rounded border border-[var(--line)] px-2 py-1 text-xs"
                  >
                    <option value="agent">agent</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">{u._count.leads}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => save(u.id)}
                    className="rounded bg-[var(--accent)] px-3 py-1 text-xs text-white"
                  >
                    Guardar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
