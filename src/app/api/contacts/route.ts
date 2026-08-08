import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { contactScopeWhere, getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      ...(session ? contactScopeWhere(session) : {}),
    },
    include: { company: true, responsible: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ contacts });
}
