import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/processes — list all registered processes */
export async function GET() {
  try {
    const processes = await prisma.processDefinition.findMany({
      orderBy: { processName: "asc" },
    });
    return NextResponse.json(processes);
  } catch (error) {
    console.error("[GET /api/processes]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/processes — register a new process */
export async function POST(request: NextRequest) {
  let body: {
    processName?: string;
    owner?: string;
    botType?: string;
    expectedStartTime?: string;
    slaMaxDuration?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    processName,
    owner = "",
    botType = "Scheduled",
    expectedStartTime = "08:00",
    slaMaxDuration = 3600,
  } = body;

  if (!processName?.trim()) {
    return NextResponse.json({ error: "processName is required" }, { status: 422 });
  }

  if (botType !== "Scheduled" && botType !== "OnDemand") {
    return NextResponse.json({ error: 'botType must be "Scheduled" or "OnDemand"' }, { status: 422 });
  }

  // Validate HH:MM only for Scheduled bots
  if (botType === "Scheduled" && !/^\d{2}:\d{2}$/.test(expectedStartTime)) {
    return NextResponse.json(
      { error: "expectedStartTime must be HH:MM (e.g. 08:30)" },
      { status: 422 }
    );
  }

  try {
    const process = await prisma.processDefinition.create({
      data: {
        processName: processName.trim(),
        owner,
        botType,
        expectedStartTime: botType === "Scheduled" ? expectedStartTime : "",
        slaMaxDuration,
      },
    });
    return NextResponse.json(process, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A process with this name already exists" },
        { status: 409 }
      );
    }
    console.error("[POST /api/processes]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
