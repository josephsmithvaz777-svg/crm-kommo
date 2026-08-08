import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    where: { deletedAt: null },
    include: { company: true, responsible: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ contacts });
}
