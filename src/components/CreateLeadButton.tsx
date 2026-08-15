"use client";

import { useState } from "react";

export function CreateLeadButton({
  onCreated,
  label = "Nuevo lead",
}: {
  onCreated?: (data: { leadId: string; contactId: string; name: string; phone: string | null; email: string | null; kommoId: number }) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear");

      onCreated?.({
        leadId: data.lead.id,
        contactId: data.contact.id,
        name: data.contact.name || data.lead.name,
        phone: phone.trim() || null,
        email: email.trim() || null,
        kommoId: data.contact.kommoId,
      });

      reset();
      setOpen(false);
      // Ir al chat del lead nuevo
      if (data.lead?.id) {
        window.location.href = `/chat?leadId=${data.lead.id}`;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-lg">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Nuevo lead manual
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Se crea el contacto y el lead en Kommo y en ConexiónCRM.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-[var(--muted)]">
                Nombre *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                  autoFocus
                />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Teléfono (WhatsApp)
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
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={submit}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "Creando..." : "Crear lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
