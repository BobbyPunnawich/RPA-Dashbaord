import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestEmail, DigestBotStats, DigestEmailPayload } from "@/lib/notifications";

export async function POST(req: Request) {
  let from: string, to: string, owner: string;
  try {
    ({ from, to, owner } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!from || !to || !owner) {
    return NextResponse.json(
      { error: "from, to, and owner are required" },
      { status: 422 }
    );
  }

  const startRange = new Date(from + "T00:00:00.000Z");
  const endRange   = new Date(to   + "T23:59:59.999Z");

  if (isNaN(startRange.getTime()) || isNaN(endRange.getTime())) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 422 });
  }
  if (startRange > endRange) {
    return NextResponse.json({ error: "from must be before or equal to to." }, { status: 422 });
  }

  // ── Build owner → botNames map from process definitions ──────────────────────
  const allProcs = await prisma.processDefinition.findMany();
  const ownerToBots = new Map<string, string[]>();
  for (const p of allProcs) {
    if (!p.owner || p.owner === "Unassigned") continue;
    const list = ownerToBots.get(p.owner) ?? [];
    list.push(p.processName);
    ownerToBots.set(p.owner, list);
  }

  // ── Determine target owners ───────────────────────────────────────────────────
  const targetOwners =
    owner === "all"
      ? Array.from(ownerToBots.keys())
      : ownerToBots.has(owner) ? [owner] : [];

  if (targetOwners.length === 0) {
    return NextResponse.json({ sent: 0, recipients: [], skipped: 0 });
  }

  // ── Fetch logs for relevant bots only ────────────────────────────────────────
  const relevantBots = new Set(targetOwners.flatMap((o) => ownerToBots.get(o) ?? []));
  const logs = await prisma.summaryLog.findMany({
    where: {
      startTime:   { gte: startRange, lte: endRange },
      processName: { in: Array.from(relevantBots) },
    },
  });

  // ── Fetch developer emails for target owners in one query ─────────────────────
  const developers = await prisma.developer.findMany({
    where: { fullName: { in: targetOwners } },
  });
  const devMap = new Map(developers.map((d) => [d.fullName, d]));

  // ── Send one digest per owner ─────────────────────────────────────────────────
  const recipients: { owner: string; email: string; bots: number; runs: number }[] = [];
  let skipped = 0;

  for (const ownerName of targetOwners) {
    const developer = devMap.get(ownerName);
    if (!developer) { skipped++; continue; }

    const botNames  = ownerToBots.get(ownerName) ?? [];
    const ownerLogs = logs.filter((l) => botNames.includes(l.processName));
    if (ownerLogs.length === 0) { skipped++; continue; }

    // ── Per-bot stats ───────────────────────────────────────────────────────────
    const botStatsMap = new Map<string, {
      runs: number; failed: number; slaBreaches: number;
      lateStarts: number; totalDuration: number;
    }>();

    for (const log of ownerLogs) {
      const s = botStatsMap.get(log.processName) ?? {
        runs: 0, failed: 0, slaBreaches: 0, lateStarts: 0, totalDuration: 0,
      };
      s.runs++;
      if (log.status === "Failed") s.failed++;
      if (log.isSLABreach)  s.slaBreaches++;
      if (log.isLateStart)  s.lateStarts++;
      s.totalDuration += log.durationSec;
      botStatsMap.set(log.processName, s);
    }

    const bots: DigestBotStats[] = Array.from(botStatsMap.entries())
      .map(([name, s]) => ({
        processName:    name,
        totalRuns:      s.runs,
        failed:         s.failed,
        slaBreaches:    s.slaBreaches,
        lateStarts:     s.lateStarts,
        successRate:    s.runs > 0 ? Math.round(((s.runs - s.failed) / s.runs) * 100) : 100,
        avgDurationSec: s.runs > 0 ? Math.round(s.totalDuration / s.runs) : 0,
      }))
      // Worst bots first, then alphabetical
      .sort((a, b) => b.failed - a.failed || b.slaBreaches - a.slaBreaches || a.processName.localeCompare(b.processName));

    // ── Aggregate stats ─────────────────────────────────────────────────────────
    const totalRuns    = ownerLogs.length;
    const failedCount  = ownerLogs.filter((l) => l.status === "Failed").length;
    const slaBreaches  = ownerLogs.filter((l) => l.isSLABreach).length;
    const lateStarts   = ownerLogs.filter((l) => l.isLateStart).length;
    const successRate  = totalRuns > 0 ? Math.round(((totalRuns - failedCount) / totalRuns) * 100) : 100;
    const avgDuration  = totalRuns > 0
      ? Math.round(ownerLogs.reduce((s, l) => s + l.durationSec, 0) / totalRuns)
      : 0;

    const digestPayload: DigestEmailPayload = {
      ownerName,
      ownerEmail: developer.email,
      period: { from, to },
      stats:  { totalRuns, successRate, slaBreaches, lateStarts, failedCount, avgDurationSec: avgDuration },
      bots,
    };

    try {
      await sendDigestEmail(digestPayload);
      recipients.push({ owner: ownerName, email: developer.email, bots: botNames.length, runs: totalRuns });
    } catch (err) {
      console.error(`[POST /api/reports/digest] email failed for ${ownerName}:`, err);
      skipped++;
    }
  }

  console.log("[POST /api/reports/digest] sent=%d skipped=%d period=%s–%s",
    recipients.length, skipped, from, to);

  return NextResponse.json({ sent: recipients.length, recipients, skipped });
}
