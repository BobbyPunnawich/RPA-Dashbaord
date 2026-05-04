import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL ?? "RPA Control Center <onboarding@resend.dev>";

// ── Shared helpers ─────────────────────────────────────────────────────────────

// Month names: avoids toLocaleString whose output varies across Node.js / Edge runtimes.
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/**
 * Formats a Date for display in emails.
 * Timestamps are stored as ICT-value-at-UTC (PAD sends "10:15 ICT" → stored as "10:15Z").
 * Reading UTC fields gives back the original local time; we append "UTC+7" for clarity.
 * Output example: "May 4, 2026, 17:31:00 UTC+7"
 */
function formatTimestamp(d: Date): string {
  const mon = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const yr  = d.getUTCFullYear();
  const hh  = String(d.getUTCHours()).padStart(2, "0");
  const mm  = String(d.getUTCMinutes()).padStart(2, "0");
  const ss  = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mon} ${day}, ${yr}, ${hh}:${mm}:${ss} UTC+7`;
}

/**
 * Formats a "YYYY-MM-DD" string as "Month D, YYYY".
 * Output example: "May 1, 2026"
 */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/**
 * Formats a date range into a compact human label.
 * Same month  → "May 1–4, 2026"
 * Same year   → "Apr 28 – May 4, 2026"
 * Diff years  → "Dec 30, 2025 – Jan 2, 2026"
 */
export function formatPeriod(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fMon = MONTH_NAMES[fm - 1];
  const tMon = MONTH_NAMES[tm - 1];
  if (fy === ty && fm === tm) return `${fMon} ${fd}–${td}, ${fy}`;
  if (fy === ty) return `${fMon.slice(0, 3)} ${fd} – ${tMon.slice(0, 3)} ${td}, ${fy}`;
  return `${fMon.slice(0, 3)} ${fd}, ${fy} – ${tMon.slice(0, 3)} ${td}, ${ty}`;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// ── Failure alert ──────────────────────────────────────────────────────────────

export interface FailureEmailPayload {
  processName:   string;
  ownerName:     string;
  transactionId: string;
  errorMessage:  string;
  startTime:     Date;
  durationSec:   number;
}

interface FailureEmailVars {
  developerName: string;
  processName:   string;
  transactionId: string;
  timestamp:     string;
  durationSec:   number;
  errorMessage:  string;
  deepLink:      string;
}

function buildFailureEmailHtml(v: FailureEmailVars): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RPA Alert: ${escapeHtml(v.processName)} failed</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:580px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

  <!-- Header -->
  <div style="background:#7f1d1d;padding:20px 28px;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#fca5a5;">RPA Control Center</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">&#9888; Bot Failure Detected</h1>
  </div>

  <!-- Body -->
  <div style="padding:28px;">

    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi <strong style="color:#e2e8f0;">${escapeHtml(v.developerName)}</strong>,
      a bot you own has reported a failure and requires your attention.
    </p>

    <!-- Run details -->
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #334155;color:#64748b;width:130px;vertical-align:top;">Process</td>
        <td style="padding:10px 0;border-bottom:1px solid #334155;color:#e2e8f0;font-weight:600;">${escapeHtml(v.processName)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #334155;color:#64748b;vertical-align:top;">Timestamp</td>
        <td style="padding:10px 0;border-bottom:1px solid #334155;color:#e2e8f0;">${v.timestamp}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #334155;color:#64748b;vertical-align:top;">Duration</td>
        <td style="padding:10px 0;border-bottom:1px solid #334155;color:#e2e8f0;">${fmtDuration(v.durationSec)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#64748b;vertical-align:top;">Transaction ID</td>
        <td style="padding:10px 0;color:#94a3b8;font-family:'Courier New',Courier,monospace;font-size:11px;word-break:break-all;">${escapeHtml(v.transactionId)}</td>
      </tr>
    </table>

    <!-- Error message -->
    <div style="background:#0f172a;border-left:3px solid #ef4444;border-radius:4px;padding:14px 16px;margin-bottom:28px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#ef4444;">Error Message</p>
      <p style="margin:0;font-size:13px;color:#fca5a5;white-space:pre-wrap;word-break:break-word;line-height:1.6;">${escapeHtml(v.errorMessage)}</p>
    </div>

    <!-- CTA button -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${v.deepLink}"
         style="display:inline-block;padding:13px 32px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">
        View Run &amp; Error Details &#8594;
      </a>
      <p style="margin:10px 0 0;font-size:11px;color:#475569;">
        The link opens the run history and automatically expands this specific error.
      </p>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px;">
    <p style="margin:0;font-size:11px;color:#475569;text-align:center;line-height:1.6;">
      Sent automatically by RPA Control Center when a bot failure is detected.<br>
      If this bot is not yours, please contact your RPA administrator.
    </p>

  </div>
</div>
</body>
</html>`;
}

/**
 * Looks up the developer by ownerName then sends an immediate failure alert.
 * Returns silently if owner is Unassigned or has no Developer record.
 * Throws on Resend transport errors so callers can log them.
 */
export async function sendFailureEmail(payload: FailureEmailPayload): Promise<void> {
  const { processName, ownerName, transactionId, errorMessage, startTime, durationSec } = payload;

  if (!ownerName || ownerName === "Unassigned") return;

  const developer = await prisma.developer.findFirst({ where: { fullName: ownerName } });
  if (!developer?.email) return;

  const deepLink  = `${appUrl()}/process/${encodeURIComponent(processName)}?tx=${encodeURIComponent(transactionId)}`;
  const timestamp = formatTimestamp(startTime);

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      developer.email,
    subject: `[RPA Alert] ${processName} failed — ${timestamp}`,
    html:    buildFailureEmailHtml({
      developerName: developer.fullName,
      processName,
      transactionId,
      timestamp,
      durationSec,
      errorMessage,
      deepLink,
    }),
  });

  if (error) throw new Error(`Resend delivery error: ${error.message}`);
}

// ── Owner digest report ────────────────────────────────────────────────────────

export interface DigestBotStats {
  processName:   string;
  totalRuns:     number;
  failed:        number;
  slaBreaches:   number;
  lateStarts:    number;
  successRate:   number;
  avgDurationSec: number;
}

export interface DigestEmailPayload {
  ownerName:  string;
  ownerEmail: string;
  period:     { from: string; to: string };
  stats: {
    totalRuns:     number;
    successRate:   number;
    slaBreaches:   number;
    lateStarts:    number;
    failedCount:   number;
    avgDurationSec: number;
  };
  bots: DigestBotStats[];
}

interface DigestEmailVars extends DigestEmailPayload {
  periodLabel:  string;
  dashboardUrl: string;
}

function statusColor(rate: number): string {
  if (rate >= 90) return "#10b981";
  if (rate >= 70) return "#eab308";
  return "#ef4444";
}

function buildDigestEmailHtml(v: DigestEmailVars): string {
  const { ownerName, periodLabel, stats, bots, dashboardUrl } = v;
  const hasIssues = stats.failedCount > 0 || stats.slaBreaches > 0;
  const topFailing = bots.filter(b => b.failed > 0).slice(0, 5);

  const botRows = bots.map((b, i) => {
    const rowBg = i % 2 === 0 ? "#1e293b" : "#172033";
    const failBg = b.failed > 0 ? "color:#fca5a5;" : "color:#94a3b8;";
    const slaBg  = b.slaBreaches > 0 ? "color:#fb923c;" : "color:#94a3b8;";
    return `
    <tr style="background:${rowBg};">
      <td style="padding:9px 12px;color:#e2e8f0;font-size:12px;border-bottom:1px solid #334155;">${escapeHtml(b.processName)}</td>
      <td style="padding:9px 12px;color:#94a3b8;font-size:12px;text-align:center;border-bottom:1px solid #334155;">${b.totalRuns}</td>
      <td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;font-weight:600;color:${statusColor(b.successRate)};">${b.successRate}%</td>
      <td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;${failBg}">${b.failed > 0 ? b.failed : "—"}</td>
      <td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;${slaBg}">${b.slaBreaches > 0 ? b.slaBreaches : "—"}</td>
      <td style="padding:9px 12px;color:#94a3b8;font-size:12px;text-align:right;border-bottom:1px solid #334155;font-family:'Courier New',monospace;">${fmtDuration(b.avgDurationSec)}</td>
    </tr>`;
  }).join("");

  const failingBotsList = topFailing.length > 0 ? `
    <!-- Top failing bots -->
    <div style="background:#1c0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#ef4444;">
        &#9888; Top Failing Bots
      </p>
      ${topFailing.map((b, i) => `
      <div style="display:block;padding:6px 0;${i > 0 ? "border-top:1px solid #2d1515;" : ""}">
        <span style="font-size:13px;color:#fca5a5;font-weight:600;">${escapeHtml(b.processName)}</span>
        <span style="font-size:12px;color:#7f1d1d;margin-left:8px;">${b.failed} failure${b.failed !== 1 ? "s" : ""}${b.slaBreaches > 0 ? ` · ${b.slaBreaches} SLA breach${b.slaBreaches !== 1 ? "es" : ""}` : ""}</span>
      </div>`).join("")}
    </div>` : `
    <!-- All clear -->
    <div style="background:#052e16;border:1px solid #14532d;border-radius:8px;padding:14px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#4ade80;">&#10003; All bots ran successfully in this period</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RPA Report: Bot Performance Digest — ${escapeHtml(periodLabel)}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

  <!-- Header -->
  <div style="background:#1e1b4b;padding:20px 28px;border-bottom:2px solid #4f46e5;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#a5b4fc;">RPA Control Center</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">&#128202; Bot Performance Digest</h1>
    <p style="margin:6px 0 0;font-size:13px;color:#818cf8;">${escapeHtml(periodLabel)}</p>
  </div>

  <!-- Body -->
  <div style="padding:28px;">

    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi <strong style="color:#e2e8f0;">${escapeHtml(ownerName)}</strong>,
      here is the performance summary for the bots you own during the selected period.
    </p>

    <!-- Summary stat cards (4-col table for email compat) -->
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:24px;">
      <tr>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 12px;text-align:center;width:25%;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#e2e8f0;">${stats.totalRuns}</p>
          <p style="margin:4px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Total Runs</p>
        </td>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 12px;text-align:center;width:25%;">
          <p style="margin:0;font-size:22px;font-weight:700;color:${statusColor(stats.successRate)};">${stats.successRate}%</p>
          <p style="margin:4px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Success Rate</p>
        </td>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 12px;text-align:center;width:25%;">
          <p style="margin:0;font-size:22px;font-weight:700;color:${stats.slaBreaches > 0 ? "#fb923c" : "#4ade80"};">${stats.slaBreaches}</p>
          <p style="margin:4px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">SLA Breaches</p>
        </td>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 12px;text-align:center;width:25%;">
          <p style="margin:0;font-size:22px;font-weight:700;color:${stats.failedCount > 0 ? "#f87171" : "#4ade80"};">${stats.failedCount}</p>
          <p style="margin:4px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Failed Runs</p>
        </td>
      </tr>
    </table>

    ${hasIssues ? failingBotsList : failingBotsList}

    <!-- Per-bot breakdown table -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Bot Breakdown</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #334155;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Bot</th>
          <th style="padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Runs</th>
          <th style="padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Success</th>
          <th style="padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Failed</th>
          <th style="padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">SLA</th>
          <th style="padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:right;border-bottom:1px solid #334155;">Avg</th>
        </tr>
      </thead>
      <tbody>
        ${botRows}
      </tbody>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${dashboardUrl}"
         style="display:inline-block;padding:13px 32px;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">
        View Full Dashboard &#8594;
      </a>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #334155;margin:0 0 16px;">
    <p style="margin:0;font-size:11px;color:#475569;text-align:center;line-height:1.6;">
      This report was generated by RPA Control Center for ${escapeHtml(periodLabel)}.<br>
      Period: ${escapeHtml(formatDate(v.period.from))} to ${escapeHtml(formatDate(v.period.to))}
      &nbsp;·&nbsp; Avg run duration: ${fmtDuration(stats.avgDurationSec)}
    </p>

  </div>
</div>
</body>
</html>`;
}

/**
 * Sends a performance digest email directly to a developer's email address.
 * The caller (digest API route) is responsible for building the payload.
 * Throws on Resend transport errors.
 */
export async function sendDigestEmail(payload: DigestEmailPayload): Promise<void> {
  const { ownerEmail, ownerName, period, stats, bots } = payload;
  const periodLabel = formatPeriod(period.from, period.to);

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      ownerEmail,
    subject: `[RPA Report] Bot Performance Digest — ${periodLabel}`,
    html:    buildDigestEmailHtml({
      ownerName,
      ownerEmail,
      period,
      stats,
      bots,
      periodLabel,
      dashboardUrl: appUrl(),
    }),
  });

  if (error) throw new Error(`Resend delivery error: ${error.message}`);
}
