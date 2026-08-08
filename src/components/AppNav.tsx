"use client";

import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/pipeline", label: "Embudos" },
  { href: "/leads", label: "Leads" },
  { href: "/chat", label: "Chat" },
  { href: "/contactos", label: "Contactos" },
  { href: "/equipo", label: "Equipo" },
  { href: "/configuracion", label: "Kommo" },
];

export function AppNav() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]">
          Conexión<span className="text-[var(--accent)]">CRM</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--sand)] hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              window.location.href = "/login";
            }}
            className="rounded-md px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--sand)] hover:text-[var(--ink)]"
          >
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
