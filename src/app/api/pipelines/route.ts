import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const pipelines = await prisma.pipeline.findMany({
    include: {
      stages: { orderBy: { sort: "asc" } },
      _count: { select: { leads: true } },
    },
    orderBy: { sort: "asc" },
  });
  return NextResponse.json({ pipelines });
}
