"use client";

import { useMemo, useState } from "react";
import { CreateLeadButton } from "@/components/CreateLeadButton";

export type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  kommoId: number;
  companyName: string | null;
  responsibleName: string | null;
};

export function ContactsTable({ contacts: initial }: { contacts: ContactRow[] }) {
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term) ||
        String(c.kommoId).includes(term),
    );
  }, [rows, q]);

  function openEdit(c: ContactRow) {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setError(null);
    setNotice(null);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");

      const next: ContactRow = {
        ...editing,
        name: data.contact.name,
        phone: data.contact.phone,
        email: data.contact.email,
        firstName: data.contact.firstName,
        lastName: data.contact.lastName,
      };
      setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      setEditing(null);
      if (data.warning) setNotice(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email..."
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <p className="text-xs text-[var(--muted)]">{filtered.length} contactos</p>
        <CreateLeadButton
          onCreated={(data) => {
            setRows((prev) => [
              {
                id: data.contactId,
                name: data.name,
                phone: data.phone,
                email: data.email,
                firstName: null,
                lastName: null,
                kommoId: data.kommoId,
                companyName: null,
                responsibleName: null,
              },
              ...prev,
            ]);
            setNotice("Lead creado en Kommo y ConexiónCRM");
          }}
        />
      </div>

      {notice && <p className="text-sm text-amber-800">{notice}</p>}

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Asesor</th>
              <th className="px-4 py-3">Kommo ID</th>
              <th className="px-4 py-3"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-[var(--line)]/70 last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--ink)]">{c.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.email || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.companyName || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.responsibleName || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{c.kommoId}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink)] hover:bg-[var(--sand)]"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--muted)]">
                  Sin contactos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-lg">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Editar contacto
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Los cambios se guardan en ConexiónCRM y se envían a Kommo.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-[var(--muted)]">
                Nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Teléfono
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+51 ..."
                  className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={save}
                className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
