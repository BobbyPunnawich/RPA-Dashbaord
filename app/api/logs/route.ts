import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LogPayload, CellStatus } from "@/types/rpa";

/** Parse "HH:MM" → minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Return the higher-priority status */
const STATUS_PRIORITY: Record<CellStatus, number> = {
  None: 0,
  Success: 1,
  LateStart: 2,
  SLABreach: 3,
  Failed: 4,
};
function higherPriority(a: CellStatus, b: CellStatus): CellStatus {
  return STATUS_PRIORITY[b] > STATUS_PRIORITY[a] ? b : a;
}

/** Day offset (1-based) from startRange */
function dayIndex(logDate: Date, startRange: Date): number {
  const s = new Date(startRange);
  s.setHours(0, 0, 0, 0);
  const d = new Date(logDate);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** Column label: show "M/D" only if date is not in the same month as startRange */
function dateLabel(offset: number, startRange: Date): string {
  const d = new Date(startRange.getTime() + (offset - 1) * 86_400_000);
  const sameMonth = d.getMonth() === startRange.getMonth();
  return sameMonth
    ? String(d.getDate())
    : `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─────────────────────────────────────────
// POST /api/logs — ingest a bot run
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  let payload: LogPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    transactionId,
    processName,
    status,
    startTime,
    endTime,
    durationSec: rawDuration,
    volumeCount,
    remarks,
    errorMessage,
    screenshotPath,
  } = payload;

  if (!transactionId || !processName || !status || !startTime) {
    return NextResponse.json(
      { error: "Missing required fields: transactionId, processName, status, startTime" },
      { status: 422 }
    );
  }
  if (status !== "Success" && status !== "Failed") {
    return NextResponse.json({ error: 'status must be "Success" or "Failed"' }, { status: 422 });
  }
  if (status === "Failed" && !errorMessage) {
    return NextResponse.json({ error: "errorMessage is required when status is Failed" }, { status: 422 });
  }

  // Resolve durationSec
  let durationSec: number;
  if (endTime) {
    durationSec = Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
    );
  } else if (rawDuration !== undefined) {
    durationSec = rawDuration;
  } else {
    return NextResponse.json(
      { error: "Provide either endTime or durationSec" },
      { status: 422 }
    );
  }

  // SLA checks
  const processDef = await prisma.processDefinition.findUnique({
    where: { processName },
  });

  let isLateStart = false;
  let isSLABreach = false;

  if (processDef) {
    isSLABreach = durationSec > processDef.slaMaxDuration;
    const actual = timeToMinutes(
      `${new Date(startTime).getHours()}:${String(new Date(startTime).getMinutes()).padStart(2, "0")}`
    );
    isLateStart = actual > timeToMinutes(processDef.expectedStartTime) + 15;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const summary = await tx.summaryLog.create({
        data: {
          transactionId,
          processName,
          status,
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : null,
          durationSec,
          volumeCount: volumeCount ?? 0,
          remarks: remarks ?? "",
          isLateStart,
          isSLABreach,
        },
      });

      if (status === "Failed") {
        await tx.errorDetail.create({
          data: {
            transactionId,
            errorMessage: errorMessage!,
            screenshotPath: screenshotPath ?? "",
          },
        });
      }

      return summary;
    });

    return NextResponse.json(
      {
        success: true,
        id: result.id,
        transactionId: result.transactionId,
        isLateStart,
        isSLABreach,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "transactionId already exists" }, { status: 409 });
    }
    console.error("[POST /api/logs]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────
// GET /api/logs — dashboard data
// Params: from, to (ISO) OR month, year (legacy)
//         search (processName or owner substring)
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const search = searchParams.get("search") ?? "";

  let startRange: Date;
  let endRange: Date;

  if (fromParam && toParam) {
    startRange = new Date(fromParam);
    startRange.setHours(0, 0, 0, 0);
    endRange = new Date(toParam);
    endRange.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()));
    startRange = new Date(year, month - 1, 1);
    endRange = new Date(year, month, 0, 23, 59, 59, 999);
  }

  try {
    // Fetch all process definitions for SLA lookups
    const allProcessDefs = await prisma.processDefinition.findMany();
    const processDefMap = new Map(allProcessDefs.map((p) => [p.processName, p]));

    // If search matches an owner, collect the matching processNames
    let searchMatchNames: string[] | null = null;
    if (search) {
      const ownerMatch = allProcessDefs.filter((p) =>
        p.owner.toLowerCase().includes(search.toLowerCase())
      );
      if (ownerMatch.length > 0) {
        searchMatchNames = ownerMatch.map((p) => p.processName);
      }
    }

    const whereClause: Record<string, unknown> = {
      startTime: { gte: startRange, lte: endRange },
    };

    if (search) {
      const orConditions: Record<string, unknown>[] = [
        { processName: { contains: search, mode: "insensitive" } },
      ];
      if (searchMatchNames && searchMatchNames.length > 0) {
        orConditions.push({ processName: { in: searchMatchNames } });
      }
      whereClause.OR = orConditions;
    }

    const logs = await prisma.summaryLog.findMany({
      where: whereClause as import("@prisma/client").Prisma.SummaryLogWhereInput,
      include: { errorDetail: true },
      orderBy: { startTime: "asc" },
    });

    // ── KPI stats ──
    const total = logs.length;
    const successes = logs.filter((l) => l.status === "Success").length;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
    const avgDurationSec =
      total > 0
        ? Math.round((logs.reduce((s, l) => s + l.durationSec, 0) / total) * 10) / 10
        : 0;
    const slaIssues = logs.filter((l) => l.isSLABreach || l.isLateStart).length;
    const slaCompliance = total > 0 ? Math.round(((total - slaIssues) / total) * 100) : 100;

    // ── Matrix ──
    type DayCell = {
      status: CellStatus;
      runCount: number;
      transactionId: string;
      durationSec: number;
      startTime: string;
      volumeCount: number;
      errorMessage: string | null;
      screenshotPath: string | null;
    };
    const processMap = new Map<string, Map<number, DayCell>>();

    for (const log of logs) {
      const idx = dayIndex(log.startTime, startRange);
      if (!processMap.has(log.processName)) {
        processMap.set(log.processName, new Map());
      }
      const dayMap = processMap.get(log.processName)!;

      let logStatus: CellStatus;
      if (log.status === "Failed") logStatus = "Failed";
      else if (log.isSLABreach) logStatus = "SLABreach";
      else if (log.isLateStart) logStatus = "LateStart";
      else logStatus = "Success";

      if (!dayMap.has(idx)) {
        dayMap.set(idx, {
          status: logStatus,
          runCount: 1,
          transactionId: log.transactionId,
          durationSec: log.durationSec,
          startTime: log.startTime.toISOString(),
          volumeCount: log.volumeCount,
          errorMessage: log.errorDetail?.errorMessage ?? null,
          screenshotPath: log.errorDetail?.screenshotPath ?? null,
        });
      } else {
        const cell = dayMap.get(idx)!;
        cell.runCount++;
        cell.volumeCount += log.volumeCount;
        cell.status = higherPriority(cell.status, logStatus);
        // Update representative run to the worst one
        if (STATUS_PRIORITY[logStatus] >= STATUS_PRIORITY[cell.status]) {
          cell.transactionId = log.transactionId;
          cell.durationSec = log.durationSec;
          cell.startTime = log.startTime.toISOString();
          cell.errorMessage = log.errorDetail?.errorMessage ?? null;
          cell.screenshotPath = log.errorDetail?.screenshotPath ?? null;
        }
      }
    }

    const totalDays =
      Math.floor((endRange.getTime() - startRange.getTime()) / 86_400_000) + 1;

    const matrix = Array.from(processMap.entries()).map(([processName, dayMap]) => ({
      processName,
      cells: Array.from({ length: totalDays }, (_, i) => {
        const idx = i + 1;
        const cell = dayMap.get(idx);
        if (!cell) {
          return {
            dayIndex: idx,
            dateLabel: dateLabel(idx, startRange),
            status: "None" as CellStatus,
            runCount: 0,
          };
        }
        return {
          dayIndex: idx,
          dateLabel: dateLabel(idx, startRange),
          status: cell.status,
          runCount: cell.runCount,
          transactionId: cell.transactionId,
          durationSec: cell.durationSec,
          startTime: cell.startTime,
          volumeCount: cell.volumeCount,
          errorMessage: cell.errorMessage,
          screenshotPath: cell.screenshotPath,
        };
      }),
    }));

    return NextResponse.json({
      stats: { successRate, avgDurationSec, slaCompliance, totalRuns: total },
      matrix,
      totalDays,
      startDate: startRange.toISOString(),
      endDate: endRange.toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/logs]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
