import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runFullMigration } from "@/lib/sync/migrate";
import { getSession } from "@/lib/auth";

export const maxDuration = 300;

export async function POST() {
  const session = await getSession();
  if (process.env.AUTH_SETUP_OPEN !== "true") {
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Solo admin puede migrar" }, { status: 403 });
    }
  }

  const running = await prisma.syncJob.findFirst({
    where: { status: "running" },
  });
  if (running) {
    return NextResponse.json(
      { error: "Ya hay una sincronización en curso", job: running },
      { status: 409 },
    );
  }

  const job = await prisma.syncJob.create({
    data: { type: "full", status: "pending", message: "En cola" },
  });

  void runFullMigration(job.id).catch((err) => {
    console.error("Migración fallida:", err);
  });

  return NextResponse.json({ job }, { status: 202 });
}

export async function GET() {
  const jobs = await prisma.syncJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ jobs });
}
