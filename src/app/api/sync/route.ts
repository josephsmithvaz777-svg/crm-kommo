import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { runFullMigration } from "@/lib/sync/migrate";
import { getSession } from "@/lib/auth";

export const maxDuration = 300;
export const runtime = "nodejs";

const STALE_MS = 2 * 60 * 1000;

async function failStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_MS);
  await prisma.syncJob.updateMany({
    where: {
      status: { in: ["running", "pending"] },
      OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, createdAt: { lt: cutoff } }],
    },
    data: {
      status: "failed",
      message: "Interrumpido (timeout en Vercel). Pulsa Migración completa otra vez.",
      finishedAt: new Date(),
      progress: 0,
    },
  });
}

function canMigrate(session: Awaited<ReturnType<typeof getSession>>) {
  if (process.env.AUTH_SETUP_OPEN === "true") return true;
  return Boolean(session && session.role === "admin");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!canMigrate(session)) {
    return NextResponse.json({ error: "Solo admin puede migrar" }, { status: 403 });
  }

  await failStaleJobs();

  const force = req.nextUrl.searchParams.get("force") === "1";
  if (force) {
    await prisma.syncJob.updateMany({
      where: { status: { in: ["running", "pending"] } },
      data: {
        status: "failed",
        message: "Cancelado manualmente",
        finishedAt: new Date(),
      },
    });
  }

  const running = await prisma.syncJob.findFirst({
    where: { status: { in: ["running", "pending"] } },
  });
  if (running) {
    return NextResponse.json(
      {
        error: "Hay una sincronización colgada o en curso. Usa force=1 o espera 2 min.",
        job: running,
        hint: "POST /api/sync?force=1",
      },
      { status: 409 },
    );
  }

  const job = await prisma.syncJob.create({
    data: { type: "full", status: "pending", message: "En cola" },
  });

  // En Vercel, void se corta al responder; after() mantiene vivo el trabajo
  after(async () => {
    try {
      await runFullMigration(job.id);
    } catch (err) {
      console.error("Migración fallida:", err);
    }
  });

  return NextResponse.json({ job }, { status: 202 });
}

export async function GET() {
  await failStaleJobs();
  const jobs = await prisma.syncJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ jobs });
}

/** Cancela jobs pending/running */
export async function DELETE() {
  const session = await getSession();
  if (!canMigrate(session)) {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const result = await prisma.syncJob.updateMany({
    where: { status: { in: ["running", "pending"] } },
    data: {
      status: "failed",
      message: "Cancelado",
      finishedAt: new Date(),
    },
  });

  return NextResponse.json({ cancelled: result.count });
}
