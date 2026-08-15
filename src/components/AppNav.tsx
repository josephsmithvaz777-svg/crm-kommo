"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/NotificationCenter";

type NavUser = { role: "admin" | "agent"; name: string } | null;

const agentLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/pipeline", label: "Embudos" },
  { href: "/leads", label: "Leads" },
  { href: "/chat", label: "Chat" },
  { href: "/contactos", label: "Contactos" },
];

const adminLinks = [
  ...agentLinks,
  { href: "/equipo", label: "Equipo" },
  { href: "/reparto", label: "Reparto" },
  { href: "/configuracion", label: "Kommo" },
];

export function AppNav() {
  const [user, setUser] = useState<NavUser>(null);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, []);

  const links =
    !user || user.role === "admin" || process.env.NEXT_PUBLIC_SETUP === "1"
      ? adminLinks
      : agentLinks;

  // Durante setup abierto sin sesión, mostrar menú admin
  const visibleLinks = user === null ? adminLinks : links;

  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]"
        >
          Conexión<span className="text-[var(--accent)]">CRM</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          {(user?.role === "agent" ? agentLinks : visibleLinks).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--sand)] hover:text-[var(--ink)]"
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <span className="hidden px-2 text-xs text-[var(--muted)] sm:inline">
              {user.name}
            </span>
          )}
          {user && (
            <div className="flex shrink-0 items-center">
              <NotificationCenter />
            </div>
          )}
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
