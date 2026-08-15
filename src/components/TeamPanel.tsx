"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  hasPassword: boolean;
  passwordReveal: string | null;
  kommoId: number | null;
  _count: { leads: number };
};

function PasswordField({
  value,
  onChange,
  placeholder,
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        placeholder={placeholder}
        minLength={required ? 6 : undefined}
        required={required}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="shrink-0 rounded border border-[var(--line)] px-2 py-1 text-[10px] uppercase text-[var(--muted)]"
        title={visible ? "Ocultar contraseña" : "Ver contraseña"}
      >
        {visible ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}

export function TeamPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"agent" | "admin">("agent");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Sin acceso");
      return;
    }
    const rows: UserRow[] = data.users || [];
    setUsers(rows);
    setCurrentUserId(data.currentUserId || null);
    setEmails(Object.fromEntries(rows.map((u) => [u.id, u.email || ""])));
    setPasswords(Object.fromEntries(rows.map((u) => [u.id, u.passwordReveal || ""])));
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
    await load();
  }

  async function createUser() {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear");
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("agent");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function removeUser(user: UserRow) {
    if (user.id === currentUserId) {
      setError("No puedes eliminarte a ti mismo");
      return;
    }
    const ok = window.confirm(
      `¿Eliminar a ${user.name}? Sus leads quedarán sin asignar. Si existe en Kommo, una sincronización puede volver a crearlo.`,
    );
    if (!ok) return;
    setError(null);
    setDeletingId(user.id);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar");
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Agrega asesores, mira o cambia su contraseña con Ver, o elimínalos. Las claves definidas
        antes de esta función hay que volver a guardarlas para poder verlas.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <form
        className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-[1fr_1fr_1.2fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void createUser();
        }}
      >
        <label className="block text-xs text-[var(--muted)]">
          Nombre
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm text-[var(--ink)]"
            placeholder="Nombre del asesor"
            required
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Email login
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm text-[var(--ink)]"
            placeholder="asesor@empresa.com"
            required
          />
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Contraseña
          <div className="mt-1">
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              placeholder="mín. 6 caracteres"
              required
              className="w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm text-[var(--ink)]"
            />
          </div>
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Rol
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "agent" | "admin")}
            className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm"
          >
            <option value="agent">agent</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {creating ? "Creando…" : "Agregar usuario"}
        </button>
      </form>
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
                  <PasswordField
                    value={passwords[u.id] || ""}
                    onChange={(value) => setPasswords((x) => ({ ...x, [u.id]: value }))}
                    placeholder={
                      u.hasPassword && !u.passwordReveal
                        ? "•••••• (guardar de nuevo para verla)"
                        : u.hasPassword
                          ? "contraseña actual"
                          : "definir"
                    }
                    className="w-36 rounded border border-[var(--line)] px-2 py-1 text-xs"
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => save(u.id)}
                      className="rounded bg-[var(--accent)] px-3 py-1 text-xs text-white"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === u.id || u.id === currentUserId}
                      onClick={() => void removeUser(u)}
                      className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 disabled:opacity-40"
                    >
                      {deletingId === u.id ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
