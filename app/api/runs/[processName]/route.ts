import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ processName: string }> }
) {
  const { processName: encoded } = await params;
  const processName = decodeURIComponent(encoded);

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  console.log("[GET /api/runs] processName=%s  from=%s  to=%s", processName, fromParam, toParam);
  console.log("[GET /api/runs] processName charCodes:", [...processName].map((c) => c.charCodeAt(0)));

  try {
    // ── 1. processName integrity check ─────────────────────────────────────
    // Fetch 1 raw row to compare exact stored name, length, and char codes.
    const nameCheck = await prisma.$queryRaw<
      Array<{ processName: string; req_len: number; db_len: number }>
    >(
      Prisma.sql`
        SELECT "processName",
               LENGTH(${processName})          AS req_len,
               LENGTH("processName")           AS db_len
        FROM   "SummaryLog"
        WHERE  "processName" ILIKE ${processName}
        LIMIT  1
      `
    );
    if (nameCheck.length > 0) {
      const row = nameCheck[0];
      console.log(
        "[GET /api/runs] processName check — req_len=%s  db_len=%s  db_value=%j",
        row.req_len, row.db_len, row.processName
      );
      console.log("[GET /api/runs] db processName charCodes:", [...row.processName].map((c) => c.charCodeAt(0)));
    } else {
      console.log("[GET /api/runs] ILIKE match found 0 rows — processName may not exist in DB at all");
    }

    // ── 2. Most-recent 2 rows (no date filter) ─────────────────────────────
    const sample = await prisma.summaryLog.findMany({
      where: { processName },
      orderBy: { startTime: "desc" },
      take: 2,
      select: { id: true, startTime: true },
    });
    console.log(
      "[GET /api/runs] latest stored startTimes:",
      sample.map((r) => `${r.startTime.toISOString()} [${r.startTime.getTime()}]`)
    );

    if (fromParam && toParam) {
      const isDateOnly = fromParam.length === 10;
      const gteDate = isDateOnly
        ? new Date(fromParam + "T00:00:00.000Z")
        : new Date(fromParam);
      const lteDate = isDateOnly
        ? new Date(toParam + "T23:59:59.999Z")
        : new Date(toParam);

      console.log(
        "[GET /api/runs] query window: %s → %s  (isDateOnly=%s)",
        gteDate.toISOString(), lteDate.toISOString(), isDateOnly
      );
      console.log(
        "[GET /api/runs] window getTime: gte=%d  lte=%d",
        gteDate.getTime(), lteDate.getTime()
      );

      const runs = await prisma.summaryLog.findMany({
        where: {
          processName,
          startTime: { gte: gteDate, lte: lteDate },
        },
        include: { errorDetail: true },
        orderBy: { startTime: "desc" },
      });

      console.log("[GET /api/runs] Prisma filtered result count=%d", runs.length);

      if (runs.length === 0) {
        // ── 3. Relaxed fallback with getTime comparison ───────────────────
        const relaxed = await prisma.summaryLog.findMany({
          where: { processName },
          orderBy: { startTime: "desc" },
          take: 5,
          select: { id: true, startTime: true },
        });
        console.log(
          "[GET /api/runs] RELAXED top-5 (iso [ms]):",
          relaxed.map((r) => `${r.startTime.toISOString()} [${r.startTime.getTime()}]`)
        );
        if (relaxed.length > 0) {
          const first = relaxed[0].startTime.getTime();
          console.log(
            "[GET /api/runs] offset check — first.getTime()=%d  gte=%d  lte=%d  inWindow=%s",
            first, gteDate.getTime(), lteDate.getTime(),
            String(first >= gteDate.getTime() && first <= lteDate.getTime())
          );
        }

        // ── 4. Wide-window ±24 h diagnostic ──────────────────────────────
        const wideGte = new Date(gteDate.getTime() - 24 * 60 * 60 * 1000);
        const wideLte = new Date(lteDate.getTime() + 24 * 60 * 60 * 1000);
        const wide = await prisma.summaryLog.findMany({
          where: { processName, startTime: { gte: wideGte, lte: wideLte } },
          orderBy: { startTime: "desc" },
          take: 5,
          select: { id: true, startTime: true },
        });
        console.log(
          "[GET /api/runs] WIDE-WINDOW ±24h count=%d  hits:",
          wide.length,
          wide.map((r) => r.startTime.toISOString())
        );

        // ── 5. Raw SQL LIKE on text cast of startTime ─────────────────────
        // e.g. fromParam = "2026-04-29"
        const dateLike = `${fromParam}%`;
        const rawRows = await prisma.$queryRaw<Array<{ id: string; startTime: string }>>(
          Prisma.sql`
            SELECT id, "startTime"::text AS "startTime"
            FROM   "SummaryLog"
            WHERE  "processName" = ${processName}
            AND    "startTime"::text LIKE ${dateLike}
            LIMIT  5
          `
        );
        console.log(
          "[GET /api/runs] RAW SQL LIKE '%s' count=%d  rows:",
          dateLike, rawRows.length, rawRows
        );
      }

      return NextResponse.json(runs);
    }

    // All-time — no date filter
    const runs = await prisma.summaryLog.findMany({
      where: { processName },
      include: { errorDetail: true },
      orderBy: { startTime: "desc" },
    });
    return NextResponse.json(runs);

  } catch (error) {
    console.error("[GET /api/runs]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
