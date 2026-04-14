import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChartDataPoint } from "@/types/rpa";

/**
 * GET /api/logs/chart?processName=X&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns daily average duration vs SLA limit for a specific process.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const processName = searchParams.get("processName");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!processName) {
    return NextResponse.json({ error: "processName is required" }, { status: 400 });
  }

  let startRange: Date;
  let endRange: Date;

  if (fromParam && toParam) {
    startRange = new Date(fromParam);
    startRange.setHours(0, 0, 0, 0);
    endRange = new Date(toParam);
    endRange.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    startRange = new Date(now.getFullYear(), now.getMonth(), 1);
    endRange = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  try {
    const [logs, processDef] = await Promise.all([
      prisma.summaryLog.findMany({
        where: {
          processName,
          startTime: { gte: startRange, lte: endRange },
        },
        orderBy: { startTime: "asc" },
        select: { startTime: true, durationSec: true },
      }),
      prisma.processDefinition.findUnique({
        where: { processName },
        select: { slaMaxDuration: true },
      }),
    ]);

    const slaLimit = processDef?.slaMaxDuration ?? 0;

    // Group logs by date string and average duration
    const grouped = new Map<string, number[]>();
    for (const log of logs) {
      const d = new Date(log.startTime);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log.durationSec);
    }

    const data: ChartDataPoint[] = Array.from(grouped.entries()).map(
      ([date, durations]) => ({
        date,
        avgDuration: Math.round(
          (durations.reduce((s, v) => s + v, 0) / durations.length) * 10
        ) / 10,
        slaLimit,
      })
    );

    return NextResponse.json({ data, slaLimit });
  } catch (error) {
    console.error("[GET /api/logs/chart]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
