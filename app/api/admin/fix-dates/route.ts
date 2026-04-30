import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Shift a BE date to CE by subtracting 543 years from the UTC year.
 * Month, day, and time components are preserved exactly.
 */
function beToce(d: Date): Date {
  const fixed = new Date(d);
  fixed.setUTCFullYear(d.getUTCFullYear() - 543);
  return fixed;
}

/**
 * GET /api/admin/fix-dates
 *
 * One-off migration: finds every SummaryLog row whose startTime or endTime
 * has a UTC year >= 2500 (Buddhist Era) and shifts it back 543 years to
 * Gregorian. Safe to call multiple times — already-fixed rows won't match
 * the WHERE clause and are skipped.
 */
export async function GET() {
  try {
    const threshold = new Date("2500-01-01T00:00:00.000Z");

    const logs = await prisma.summaryLog.findMany({
      where: {
        OR: [
          { startTime: { gte: threshold } },
          { endTime:   { gte: threshold } },
        ],
      },
      select: { id: true, startTime: true, endTime: true, durationSec: true },
    });

    console.log("[fix-dates] found %d record(s) to correct", logs.length);

    if (logs.length === 0) {
      return NextResponse.json({
        fixed: 0,
        message: "No records needed correction — database is already in Gregorian format.",
      });
    }

    const updates = logs.map((log) => {
      const fixStart = log.startTime.getUTCFullYear() >= 2500;
      const fixEnd   = log.endTime != null && log.endTime.getUTCFullYear() >= 2500;

      const newStart = fixStart ? beToce(log.startTime) : log.startTime;
      const newEnd   = fixEnd && log.endTime ? beToce(log.endTime) : log.endTime;

      // Duration is the difference between the two timestamps — shifting both
      // by the same 543 years leaves the gap unchanged. Recalculate anyway so
      // mixed records (one field fixed, one already CE) come out correct.
      const newDuration =
        newEnd != null
          ? Math.max(0, Math.round((newEnd.getTime() - newStart.getTime()) / 1000))
          : log.durationSec;

      return prisma.summaryLog.update({
        where: { id: log.id },
        data: {
          startTime:   newStart,
          ...(newEnd !== undefined ? { endTime: newEnd } : {}),
          durationSec: newDuration,
        },
      });
    });

    await prisma.$transaction(updates);

    console.log("[fix-dates] corrected %d record(s)", logs.length);

    return NextResponse.json({
      fixed:   logs.length,
      message: `Corrected ${logs.length} record${logs.length !== 1 ? "s" : ""} from Buddhist Era to Gregorian calendar.`,
    });
  } catch (error) {
    console.error("[fix-dates]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
