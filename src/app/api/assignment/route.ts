import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAssignmentConfig,
  redistributeLeads,
  setSetting,
} from "@/lib/assignment";
import { prisma } from "@/lib/db";

function canManage(session: Awaited<ReturnType<typeof getSession>>) {
  if (process.env.AUTH_SETUP_OPEN === "true") return true;
  return Boolean(session && session.role === "admin");
}

export async function GET() {
  const session = await getSession();
  if (!canManage(session)) {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }
  const config = await getAssignmentConfig();
  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!canManage(session)) {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const body = (await req.json()) as {
    autoAssign?: boolean;
    userId?: string;
    inAssignPool?: boolean;
  };

  if (typeof body.autoAssign === "boolean") {
    await setSetting("lead_auto_assign", body.autoAssign ? "true" : "false");
  }

  if (body.userId && typeof body.inAssignPool === "boolean") {
    await prisma.user.update({
      where: { id: body.userId },
      data: { inAssignPool: body.inAssignPool },
    });
  }

  return NextResponse.json(await getAssignmentConfig());
}

/** Redistribuye leads existentes entre el pool */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!canManage(session)) {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { forceAll?: boolean };
  const result = await redistributeLeads({ forceAll: Boolean(body.forceAll) });
  return NextResponse.json(result);
}
