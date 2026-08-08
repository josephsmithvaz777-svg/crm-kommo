import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContactosPage() {
  const contacts = await prisma.contact.findMany({
    where: { deletedAt: null },
    include: { company: true, responsible: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Contactos
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{contacts.length} registros recientes</p>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-[var(--line)]/70 last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--ink)]">{c.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.email || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.company?.name || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{c.responsible?.name || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">{c.kommoId}</td>
              </tr>
            ))}
            {!contacts.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  Sin contactos. Ejecuta la migración desde Configuración.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
