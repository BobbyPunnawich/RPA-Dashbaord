import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LogPayload, CellStatus } from "@/types/rpa";

/** Parse "HH:MM" → minutes since midnight */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Parse a PAD timestamp string.
 * PAD bots send local ICT time either without a TZ designator ("2026-04-29T10:15:00")
 * or with a bare "Z" that incorrectly marks the local time as UTC
 * ("2026-04-29T10:15:00Z"). In both cases the numeric value IS the local ICT time
 * — we preserve it as-is so that 10:15 is stored as 10:15 UTC, which the
 * frontend then displays as "10:15" without any further conversion.
 * Do NOT append +07:00 here; that would shift the stored epoch by -7 h and
 * cause the display (UTC) to show 03:15 instead of 10:15.
 */
function parseTimestamp(iso: string): Date {
  return new Date(iso);
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

/**
 * Day offset (1-based) from startRange.
 * Data is stored as ICT-value-at-UTC (10:15 ICT → 10:15 UTC), so simple
 * UTC-day arithmetic gives the correct calendar column.
 */
function dayIndex(logDate: Date, startRange: Date): number {
  const MS = 86_400_000;
  return Math.floor(logDate.getTime() / MS) - Math.floor(startRange.getTime() / MS) + 1;
}

/** Column label: "D" within same month, "M/D" across months — UTC calendar. */
function dateLabel(offset: number, startRange: Date): string {
  const d = new Date(startRange.getTime() + (offset - 1) * 86_400_000);
  return d.getUTCMonth() === startRange.getUTCMonth()
    ? String(d.getUTCDate())
    : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// ─────────────────────────────────────────
// POST /api/logs — smart webhook entry point
// PAD bots send minimal payload; server handles
// auto-registration, duration calc, SLA checks.
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  let payload: LogPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    processName,
    status,
    startTime,
    endTime,
    runBy,
    errorCode,
    errorMessage,
    screenshotPath,
    volumeCount,
    remarks,
  } = payload;

  // ── Log every incoming payload so issues are visible in the terminal ──
  console.log("[POST /api/logs] received payload:", {
    processName, status, startTime, endTime, runBy, errorCode,
    errorMessage: errorMessage?.slice(0, 80),
  });

  // ── Validate required fields ──
  if (!processName || !status || !startTime || !endTime) {
    console.warn("[POST /api/logs] 422 missing fields:", { processName, status, startTime, endTime });
    return NextResponse.json(
      { error: "Missing required fields: processName, status, startTime, endTime" },
      { status: 422 }
    );
  }

  // PAD uses "None" as its "no error occurred" sentinel.
  // Treat it as a successful completion so runs are not silently discarded.
  const resolvedStatus: "Success" | "Failed" =
    status === "None" || status === "Success" ? "Success" : "Failed";

  if (status !== "Success" && status !== "Failed" && status !== "None") {
    console.warn("[POST /api/logs] 422 unrecognised status:", status);
    return NextResponse.json(
      { error: 'status must be "Success", "Failed", or "None"' },
      { status: 422 }
    );
  }
  if (resolvedStatus === "Failed" && !errorMessage) {
    console.warn("[POST /api/logs] 422 Failed but no errorMessage");
    return NextResponse.json(
      { error: "errorMessage is required when status is Failed" },
      { status: 422 }
    );
  }
  if (status === "None") {
    console.log('[POST /api/logs] status "None" mapped to "Success" (PAD no-error sentinel)');
  }

  // ── Server-side duration & SLA calculation ──
  const start = parseTimestamp(startTime);
  const end   = parseTimestamp(endTime);
  const durationSec = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

  // ── Auto-register process if it doesn't exist ──
  // Explicit defaults so PAD-triggered bots land as OnDemand / Unassigned.
  const processDef = await prisma.processDefinition.upsert({
    where: { processName },
    update: {},
    create: {
      processName,
      owner:             "Unassigned",
      botType:           "OnDemand",
      slaMaxDuration:    1800,
      expectedStartTime: "",
    },
  });

  // ── SLA checks ──
  const isSLABreach = durationSec > processDef.slaMaxDuration;
  const actualMinutes = timeToMinutes(
    `${start.getHours()}:${String(start.getMinutes()).padStart(2, "0")}`
  );
  const isLateStart =
    processDef.botType === "Scheduled" &&
    actualMinutes > timeToMinutes(processDef.expectedStartTime) + 15;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const summary = await tx.summaryLog.create({
        data: {
          processName,
          status: resolvedStatus,
          startTime: start,
          endTime: end,
          durationSec,
          runBy: runBy ?? null,
          errorCode: errorCode ?? null,
          volumeCount: volumeCount ?? 0,
          remarks: remarks ?? "",
          isLateStart,
          isSLABreach,
        },
      });

      if (resolvedStatus === "Failed") {
        await tx.errorDetail.create({
          data: {
            transactionId: summary.transactionId,
            errorCode: errorCode ?? null,
            errorMessage: errorMessage!,
            screenshotPath: screenshotPath ?? "",
          },
        });
      }

      return summary;
    });

    console.log("[POST /api/logs] saved → id=%d txId=%s status=%s dur=%ds",
      result.id, result.transactionId, resolvedStatus, durationSec);
    return NextResponse.json(
      {
        success: true,
        id: result.id,
        transactionId: result.transactionId,
        isLateStart,
        isSLABreach,
        durationSec,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
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
  const rawUrl = process.env.DATABASE_URL ?? "(not set)";
  const maskedUrl = rawUrl.replace(/:([^@]+)@/, ":***@");
  console.log("[GET /api/logs] DATABASE_URL =", maskedUrl);

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const search = searchParams.get("search") ?? "";

  let startRange: Date;
  let endRange: Date;

  if (fromParam && toParam) {
    // Plain UTC midnight boundaries. Data is stored as ICT-value-at-UTC
    // (e.g. 10:15 ICT → 10:15Z), so the UTC calendar day equals the ICT
    // calendar day and no offset shift is needed here.
    startRange = new Date(fromParam + "T00:00:00.000Z");
    endRange   = new Date(toParam   + "T23:59:59.999Z");
    console.log("[GET /api/logs] from=%s to=%s → range %s – %s",
      fromParam, toParam, startRange.toISOString(), endRange.toISOString());
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
    console.log("[GET /api/logs] query returned %d log(s)", logs.length);

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

    // ── Exact per-status breakdown (used for accurate chart counts) ──
    const cntFailed    = logs.filter((l) => l.status === "Failed").length;
    const cntSLABreach = logs.filter((l) => l.status === "Success" && l.isSLABreach).length;
    const cntLateStart = logs.filter((l) => l.status === "Success" && !l.isSLABreach && l.isLateStart).length;
    const cntSuccess   = logs.filter((l) => l.status === "Success" && !l.isSLABreach && !l.isLateStart).length;

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

    // ── All-time run counts per process (for the "Runs" sticky column) ──
    // This is a lightweight groupBy — one row per process, never the full log set.
    const allTimeGroups = await prisma.summaryLog.groupBy({
      by: ["processName"],
      _count: { id: true },
    });
    const allTimeCounts: Record<string, number> = {};
    for (const row of allTimeGroups) {
      allTimeCounts[row.processName] = row._count.id;
    }

    return NextResponse.json({
      stats: {
        totalRuns: total,
        successRate,
        slaCompliance,
        avgDurationSec,
        breakdown: {
          success:   cntSuccess,
          lateStart: cntLateStart,
          slaBreach: cntSLABreach,
          failed:    cntFailed,
          slaIssues,
        },
      },
      matrix,
      totalDays,
      startDate: startRange.toISOString(),
      endDate: endRange.toISOString(),
      allTimeCounts,
    });
  } catch (error) {
    console.error("[GET /api/logs]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
