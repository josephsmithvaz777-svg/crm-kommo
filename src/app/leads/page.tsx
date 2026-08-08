import { prisma } from "@/lib/db";
import { getSession, leadScopeWhere } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LeadAssignSelect } from "@/components/LeadAssignSelect";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") redirect("/login");

  const isAdmin =
    process.env.AUTH_SETUP_OPEN === "true" || session?.role === "admin";

  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(session ? leadScopeWhere(session) : {}),
    },
    include: {
      stage: true,
      pipeline: true,
      responsible: true,
      company: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const assignees = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true, passwordHash: { not: null } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            Leads
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {session?.role === "agent"
              ? `Tus leads asignados (${leads.length})`
              : `${leads.length} registros · reparto en /reparto`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Asesor</th>
              <th className="px-4 py-3">Fuente</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Chat</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--line)]/70 last:border-0">
                <td className="px-4 py-3 font-medium text-[var(--ink)]">{lead.name}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{lead.stage?.name || "—"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {isAdmin ? (
                    <LeadAssignSelect
                      leadId={lead.id}
                      currentId={lead.responsibleId}
                      users={assignees}
                    />
                  ) : (
                    lead.responsible?.name || "—"
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{lead.source || "—"}</td>
                <td className="px-4 py-3 text-[var(--ink)]">
                  ${lead.price.toLocaleString("es-MX")}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/chat?leadId=${lead.id}`} className="text-[var(--accent)] underline">
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  Sin leads. Ejecuta la migración o espera webhooks / reparto.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
