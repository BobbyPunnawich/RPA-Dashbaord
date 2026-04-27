import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/runs/[processName] — backlog for one process, newest first */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ processName: string }> }
) {
  const { processName: encoded } = await params;
  const processName = decodeURIComponent(encoded);

  try {
    const runs = await prisma.summaryLog.findMany({
      where: { processName },
      include: { errorDetail: true },
      orderBy: { startTime: "desc" },
    });
    return NextResponse.json(runs);
  } catch (error) {
    console.error("[GET /api/runs/[processName]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
