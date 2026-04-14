import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** PUT /api/processes/[id] — update SLA settings */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: {
    owner?: string;
    expectedStartTime?: string;
    slaMaxDuration?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { owner, expectedStartTime, slaMaxDuration } = body;

  if (expectedStartTime && !/^\d{2}:\d{2}$/.test(expectedStartTime)) {
    return NextResponse.json(
      { error: "expectedStartTime must be HH:MM" },
      { status: 422 }
    );
  }

  try {
    const updated = await prisma.processDefinition.update({
      where: { id: numId },
      data: {
        ...(owner !== undefined && { owner }),
        ...(expectedStartTime !== undefined && { expectedStartTime }),
        ...(slaMaxDuration !== undefined && { slaMaxDuration }),
      },
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Process not found" }, { status: 404 });
    }
    console.error("[PUT /api/processes/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/processes/[id] — delete process and cascade all its logs */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // Resolve processName first
    const processDef = await prisma.processDefinition.findUnique({
      where: { id: numId },
    });
    if (!processDef) {
      return NextResponse.json({ error: "Process not found" }, { status: 404 });
    }

    // Cascade: delete ErrorDetails → SummaryLogs → ProcessDefinition atomically
    await prisma.$transaction(async (tx) => {
      // Find all transactionIds belonging to this process
      const logs = await tx.summaryLog.findMany({
        where: { processName: processDef.processName },
        select: { transactionId: true },
      });
      const txIds = logs.map((l) => l.transactionId);

      if (txIds.length > 0) {
        await tx.errorDetail.deleteMany({ where: { transactionId: { in: txIds } } });
        await tx.summaryLog.deleteMany({
          where: { processName: processDef.processName },
        });
      }

      await tx.processDefinition.delete({ where: { id: numId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/processes/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
