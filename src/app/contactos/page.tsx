import { prisma } from "@/lib/db";
import { contactScopeWhere, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContactsTable } from "@/components/ContactsTable";

export const dynamic = "force-dynamic";

export default async function ContactosPage() {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") redirect("/login");

  const contacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      ...(session ? contactScopeWhere(session) : {}),
    },
    include: { company: true, responsible: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const rows = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    kommoId: c.kommoId,
    companyName: c.company?.name || null,
    responsibleName: c.responsible?.name || null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          Contactos
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {session?.role === "agent"
            ? `Tus contactos asignados (${contacts.length}) · puedes editar nombre, teléfono y email`
            : `${contacts.length} registros recientes · edita y sincroniza con Kommo`}
        </p>
      </div>

      <ContactsTable contacts={rows} />
    </div>
  );
}
