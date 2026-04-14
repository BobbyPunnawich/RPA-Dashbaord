import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LogPayload } from "@/types/rpa";

export async function POST(request: NextRequest) {
  let payload: LogPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { transactionId, processName, status, startTime, durationSec, volumeCount, errorMessage, screenshotPath } =
    payload;

  // Basic validation
  if (!transactionId || !processName || !status || !startTime || durationSec === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: transactionId, processName, status, startTime, durationSec" },
      { status: 422 }
    );
  }

  if (status !== "Success" && status !== "Failed") {
    return NextResponse.json({ error: 'status must be "Success" or "Failed"' }, { status: 422 });
  }

  if (status === "Failed" && !errorMessage) {
    return NextResponse.json({ error: "errorMessage is required when status is Failed" }, { status: 422 });
  }

  try {
    // Use a database transaction — zero file-locking, atomic writes
    const result = await prisma.$transaction(async (tx) => {
      const summary = await tx.summaryLog.create({
        data: {
          transactionId,
          processName,
          status,
          startTime: new Date(startTime),
          durationSec,
          volumeCount: volumeCount ?? 0,
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

    return NextResponse.json({ success: true, id: result.id, transactionId: result.transactionId }, { status: 201 });
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  try {
    const logs = await prisma.summaryLog.findMany({
      where: {
        startTime: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { errorDetail: true },
      orderBy: { startTime: "asc" },
    });

    // Executive stats
    const total = logs.length;
    const successes = logs.filter((l) => l.status === "Success").length;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
    const avgDurationSec =
      total > 0 ? Math.round((logs.reduce((sum, l) => sum + l.durationSec, 0) / total) * 10) / 10 : 0;
    const totalVolume = logs.reduce((sum, l) => sum + l.volumeCount, 0);

    // Build process matrix: processName → day → latest run
    const processMap = new Map<string, Map<number, (typeof logs)[0]>>();
    for (const log of logs) {
      const day = new Date(log.startTime).getDate();
      if (!processMap.has(log.processName)) {
        processMap.set(log.processName, new Map());
      }
      // Keep the latest run per day per process
      processMap.get(log.processName)!.set(day, log);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const matrix = Array.from(processMap.entries()).map(([processName, dayMap]) => ({
      processName,
      cells: Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const log = dayMap.get(day);
        if (!log) return { day, status: "None" };
        return {
          day,
          status: log.status,
          transactionId: log.transactionId,
          durationSec: log.durationSec,
          errorMessage: log.errorDetail?.errorMessage ?? null,
          screenshotPath: log.errorDetail?.screenshotPath ?? null,
        };
      }),
    }));

    return NextResponse.json({
      stats: { successRate, avgDurationSec, totalVolume, totalRuns: total },
      matrix,
      month,
      year,
    });
  } catch (error) {
    console.error("[GET /api/logs]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
