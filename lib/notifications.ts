import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL ?? "RPA Control Center <onboarding@resend.dev>";

// ── Shared helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/** DD/MM/YYYY — primary date display format in all emails */
function fmtDDMMYYYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function fmtTime(d: Date): string {
  return (
    String(d.getUTCHours()).padStart(2, "0") + ":" +
    String(d.getUTCMinutes()).padStart(2, "0") + ":" +
    String(d.getUTCSeconds()).padStart(2, "0")
  );
}

/** Full timestamp: "04/05/2026, 17:31:00 UTC+7" */
function formatTimestamp(d: Date): string {
  return `${fmtDDMMYYYY(d)}, ${fmtTime(d)} UTC+7`;
}

/** "YYYY-MM-DD" → "Month D, YYYY" */
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
function formatDateDMY(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}

export function formatPeriod(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fMon = MONTH_NAMES[fm - 1];
  const tMon = MONTH_NAMES[tm - 1];
  if (fy === ty && fm === tm) return `${fMon} ${fd}–${td}, ${fy}`;
  if (fy === ty) return `${fMon.slice(0,3)} ${fd} – ${tMon.slice(0,3)} ${td}, ${fy}`;
  return `${fMon.slice(0,3)} ${fd}, ${fy} – ${tMon.slice(0,3)} ${td}, ${ty}`;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// ── Run notification email (every transaction) ────────────────────────────────

export type RunStatus = "Success" | "Failed" | "SLABreach" | "LateStart";

export interface RunNotificationPayload {
  processName:    string;
  ownerName:      string;
  transactionId:  string;
  startTime:      Date;
  durationSec:    number;
  resolvedStatus: RunStatus;
  errorMessage?:  string | null;
}

interface RunStatusStyle {
  headerBg:    string;
  accentColor: string;
  label:       string;
  emoji:       string;
}

const RUN_STATUS_STYLES: Record<RunStatus, RunStatusStyle> = {
  Success:   { headerBg: "#052e16", accentColor: "#4ade80", label: "Completed",  emoji: "✓" },
  Failed:    { headerBg: "#7f1d1d", accentColor: "#f87171", label: "Failed",     emoji: "✗" },
  SLABreach: { headerBg: "#431407", accentColor: "#fb923c", label: "SLA Breach", emoji: "⚠" },
  LateStart: { headerBg: "#422006", accentColor: "#fde68a", label: "Late Start", emoji: "⚠" },
};

function buildRunNotificationEmailHtml(v: {
  developerName:  string;
  processName:    string;
  transactionId:  string;
  dateStr:        string;  // DD/MM/YYYY
  timeStr:        string;  // HH:mm:ss
  durationSec:    number;
  resolvedStatus: RunStatus;
  errorMessage?:  string | null;
  deepLink:       string;
}): string {
  const st = RUN_STATUS_STYLES[v.resolvedStatus];
  const isIssue = v.resolvedStatus !== "Success";

  const errorBlock = v.resolvedStatus === "Failed" && v.errorMessage ? `
    <div style="background:#0f172a;border-left:3px solid #ef4444;border-radius:4px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#ef4444;">Error Message</p>
      <p style="margin:0;font-size:13px;color:#fca5a5;white-space:pre-wrap;word-break:break-word;line-height:1.6;">${escapeHtml(v.errorMessage)}</p>
    </div>` : "";

  const ctaButton = isIssue ? `
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${v.deepLink}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;font-size:13px;font-weight:600;border-radius:8px;text-decoration:none;">
        View Run Details &#8594;
      </a>
      <p style="margin:8px 0 0;font-size:11px;color:#475569;">Opens the process page and highlights this run.</p>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RPA — ${escapeHtml(v.processName)} ${st.label}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

  <div style="background:${st.headerBg};padding:18px 28px;border-bottom:2px solid ${st.accentColor};">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${st.accentColor};">RPA Control Center</p>
    <h1 style="margin:5px 0 0;font-size:18px;font-weight:700;color:#fff;line-height:1.3;">${st.emoji} Bot Run ${st.label}</h1>
  </div>

  <div style="padding:24px 28px;">
    <p style="margin:0 0 18px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi <strong style="color:#e2e8f0;">${escapeHtml(v.developerName)}</strong>, here is the run report for a bot you own.
    </p>

    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#64748b;width:130px;">Bot</td>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#e2e8f0;font-weight:600;">${escapeHtml(v.processName)}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#64748b;">Date</td>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#e2e8f0;">${v.dateStr}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#64748b;">Time</td>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#e2e8f0;">${v.timeStr} UTC+7</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#64748b;">Duration</td>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#e2e8f0;">${fmtDuration(v.durationSec)}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #334155;color:#64748b;">Status</td>
        <td style="padding:9px 0;border-bottom:1px solid #334155;">
          <span style="display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;background:${st.headerBg};color:${st.accentColor};border:1px solid ${st.accentColor}33;">${st.label}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:9px 0;color:#64748b;vertical-align:top;">Transaction ID</td>
        <td style="padding:9px 0;color:#94a3b8;font-family:'Courier New',Courier,monospace;font-size:11px;word-break:break-all;">${escapeHtml(v.transactionId)}</td>
      </tr>
    </table>

    ${errorBlock}
    ${ctaButton}

    <hr style="border:none;border-top:1px solid #334155;margin:0 0 14px;">
    <p style="margin:0;font-size:11px;color:#475569;text-align:center;line-height:1.6;">
      Sent automatically by RPA Control Center on every bot run completion.<br>
      If this bot is not yours, contact your RPA administrator.
    </p>
  </div>
</div>
</body></html>`;
}

export async function sendRunNotificationEmail(payload: RunNotificationPayload): Promise<void> {
  const { processName, ownerName, transactionId, startTime, durationSec, resolvedStatus, errorMessage } = payload;
  if (!ownerName || ownerName === "Unassigned") return;

  const developer = await prisma.developer.findFirst({ where: { fullName: ownerName } });
  if (!developer?.email) return;

  const deepLink = `${appUrl()}/process/${encodeURIComponent(processName)}?tx=${encodeURIComponent(transactionId)}`;
  const st       = RUN_STATUS_STYLES[resolvedStatus];
  const prefix   = resolvedStatus === "Failed" ? "[RPA Alert]" : "[RPA]";

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      developer.email,
    subject: `${prefix} ${processName} — ${st.label} | ${fmtDDMMYYYY(startTime)}`,
    html:    buildRunNotificationEmailHtml({
      developerName:  developer.fullName,
      processName,
      transactionId,
      dateStr:        fmtDDMMYYYY(startTime),
      timeStr:        fmtTime(startTime),
      durationSec,
      resolvedStatus,
      errorMessage,
      deepLink,
    }),
  });

  if (error) throw new Error(`Resend delivery error: ${error.message}`);
}

// ── Failure alert (kept for backward compat, internally delegates) ─────────────

export interface FailureEmailPayload {
  processName:   string;
  ownerName:     string;
  transactionId: string;
  errorMessage:  string;
  startTime:     Date;
  durationSec:   number;
}

export async function sendFailureEmail(payload: FailureEmailPayload): Promise<void> {
  return sendRunNotificationEmail({ ...payload, resolvedStatus: "Failed" });
}

// ── Owner digest report ────────────────────────────────────────────────────────

export interface DigestTransaction {
  transactionId: string;
  startTime:     Date;
  durationSec:   number;
  status:        RunStatus;
  errorMessage:  string | null;
}

export interface DigestBotStats {
  processName:    string;
  totalRuns:      number;
  failed:         number;
  slaBreaches:    number;
  lateStarts:     number;
  successRate:    number;
  avgDurationSec: number;
  transactions:   DigestTransaction[];
}

export interface DigestEmailPayload {
  ownerName:  string;
  ownerEmail: string;
  period:     { from: string; to: string };
  stats: {
    totalRuns:      number;
    successRate:    number;
    slaBreaches:    number;
    lateStarts:     number;
    failedCount:    number;
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

function txStatusBadge(status: RunStatus): string {
  const styles: Record<RunStatus, { bg: string; color: string; label: string }> = {
    Success:   { bg: "#052e16", color: "#4ade80", label: "Success"   },
    Failed:    { bg: "#7f1d1d", color: "#f87171", label: "Failed"    },
    SLABreach: { bg: "#431407", color: "#fb923c", label: "SLA Breach"},
    LateStart: { bg: "#422006", color: "#fde68a", label: "Late Start"},
  };
  const s = styles[status];
  return `<span style="display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700;background:${s.bg};color:${s.color};border:1px solid ${s.color}33;">${s.label}</span>`;
}

function buildTransactionTable(bot: DigestBotStats): string {
  const MAX_ROWS = 25;
  const rows = bot.transactions.slice(0, MAX_ROWS);
  if (rows.length === 0) return "";

  const rowHtml = rows.map((t, i) => {
    const rowBg = i % 2 === 0 ? "#1e293b" : "#172033";
    const errCell = t.errorMessage
      ? `<span style="color:#fca5a5;font-size:10px;">${escapeHtml(t.errorMessage.slice(0, 60))}${t.errorMessage.length > 60 ? "…" : ""}</span>`
      : `<span style="color:#334155;">—</span>`;
    return `<tr style="background:${rowBg};">
      <td style="padding:6px 10px;font-size:11px;color:#94a3b8;border-bottom:1px solid #1e293b;white-space:nowrap;">${fmtDDMMYYYY(t.startTime)}</td>
      <td style="padding:6px 10px;font-size:11px;color:#94a3b8;border-bottom:1px solid #1e293b;white-space:nowrap;">${fmtTime(t.startTime)}</td>
      <td style="padding:6px 10px;font-family:'Courier New',monospace;font-size:10px;color:#64748b;border-bottom:1px solid #1e293b;word-break:break-all;">${escapeHtml(t.transactionId)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #1e293b;white-space:nowrap;">${txStatusBadge(t.status)}</td>
      <td style="padding:6px 10px;font-size:11px;color:#94a3b8;text-align:right;border-bottom:1px solid #1e293b;white-space:nowrap;font-family:'Courier New',monospace;">${fmtDuration(t.durationSec)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #1e293b;max-width:160px;">${errCell}</td>
    </tr>`;
  }).join("");

  const overflowNote = bot.transactions.length > MAX_ROWS
    ? `<tr><td colspan="6" style="padding:6px 10px;font-size:10px;color:#475569;text-align:center;background:#0f172a;">… and ${bot.transactions.length - MAX_ROWS} more transactions (see full dashboard)</td></tr>`
    : "";

  return `
  <p style="margin:16px 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">
    Transaction Log — ${escapeHtml(bot.processName)}
  </p>
  <div style="overflow:hidden;border:1px solid #334155;border-radius:6px;margin-bottom:20px;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#0f172a;">
        <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Date</th>
        <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Time</th>
        <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Transaction ID</th>
        <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Status</th>
        <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;text-align:right;border-bottom:1px solid #334155;">Duration</th>
        <th style="padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Error</th>
      </tr>
    </thead>
    <tbody>${rowHtml}${overflowNote}</tbody>
  </table>
  </div>`;
}

function buildDigestEmailHtml(v: DigestEmailVars): string {
  const { ownerName, periodLabel, stats, bots, dashboardUrl } = v;
  const topFailing = bots.filter((b) => b.failed > 0).slice(0, 5);

  const issueBlock = topFailing.length > 0 ? `
    <div style="background:#1c0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#ef4444;">&#9888; Top Failing Bots</p>
      ${topFailing.map((b, i) => `
      <div style="${i > 0 ? "border-top:1px solid #2d1515;" : ""}padding:5px 0;">
        <span style="font-size:13px;color:#fca5a5;font-weight:600;">${escapeHtml(b.processName)}</span>
        <span style="font-size:12px;color:#7f1d1d;margin-left:8px;">${b.failed} failure${b.failed !== 1 ? "s" : ""}${b.slaBreaches > 0 ? ` · ${b.slaBreaches} SLA breach${b.slaBreaches !== 1 ? "es" : ""}` : ""}</span>
      </div>`).join("")}
    </div>` : `
    <div style="background:#052e16;border:1px solid #14532d;border-radius:8px;padding:14px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#4ade80;">&#10003; All bots ran successfully in this period</p>
    </div>`;

  const botSummaryRows = bots.map((b, i) => {
    const rowBg   = i % 2 === 0 ? "#1e293b" : "#172033";
    const failTd  = b.failed > 0
      ? `<td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;color:#fca5a5;font-weight:600;">${b.failed}</td>`
      : `<td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;color:#334155;">—</td>`;
    const slaTd   = b.slaBreaches > 0
      ? `<td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;color:#fb923c;font-weight:600;">${b.slaBreaches}</td>`
      : `<td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;color:#334155;">—</td>`;
    return `<tr style="background:${rowBg};">
      <td style="padding:9px 12px;color:#e2e8f0;font-size:12px;border-bottom:1px solid #334155;">${escapeHtml(b.processName)}</td>
      <td style="padding:9px 12px;color:#94a3b8;font-size:12px;text-align:center;border-bottom:1px solid #334155;">${b.totalRuns}</td>
      <td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #334155;font-weight:600;color:${statusColor(b.successRate)};">${b.successRate}%</td>
      ${failTd}${slaTd}
      <td style="padding:9px 12px;color:#94a3b8;font-size:12px;text-align:right;border-bottom:1px solid #334155;font-family:'Courier New',monospace;">${fmtDuration(b.avgDurationSec)}</td>
    </tr>`;
  }).join("");

  const transactionTables = bots.map(buildTransactionTable).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RPA Report: Digest — ${escapeHtml(periodLabel)}</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:660px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

  <div style="background:#1e1b4b;padding:20px 28px;border-bottom:2px solid #4f46e5;">
    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#a5b4fc;">RPA Control Center</p>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;line-height:1.3;">&#128202; Bot Performance Digest</h1>
    <p style="margin:5px 0 0;font-size:13px;color:#818cf8;">${escapeHtml(periodLabel)} &nbsp;·&nbsp; ${formatDateDMY(v.period.from)} – ${formatDateDMY(v.period.to)}</p>
  </div>

  <div style="padding:28px;">
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi <strong style="color:#e2e8f0;">${escapeHtml(ownerName)}</strong>, here is the performance summary for the bots you own.
    </p>

    <!-- KPI cards -->
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px;margin-bottom:24px;">
      <tr>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#e2e8f0;">${stats.totalRuns}</p>
          <p style="margin:3px 0 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Total Runs</p>
        </td>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:${statusColor(stats.successRate)};">${stats.successRate}%</p>
          <p style="margin:3px 0 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Success Rate</p>
        </td>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:${stats.slaBreaches > 0 ? "#fb923c" : "#4ade80"};">${stats.slaBreaches}</p>
          <p style="margin:3px 0 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">SLA Breaches</p>
        </td>
        <td style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;color:${stats.failedCount > 0 ? "#f87171" : "#4ade80"};">${stats.failedCount}</p>
          <p style="margin:3px 0 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;">Failed Runs</p>
        </td>
      </tr>
    </table>

    ${issueBlock}

    <!-- Bot summary table -->
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Bot Summary</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #334155;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:left;border-bottom:1px solid #334155;">Bot</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Runs</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Success</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">Failed</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center;border-bottom:1px solid #334155;">SLA</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:right;border-bottom:1px solid #334155;">Avg</th>
        </tr>
      </thead>
      <tbody>${botSummaryRows}</tbody>
    </table>

    <!-- Per-bot transaction logs -->
    ${transactionTables}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${dashboardUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
        View Full Dashboard &#8594;
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #334155;margin:0 0 14px;">
    <p style="margin:0;font-size:11px;color:#475569;text-align:center;line-height:1.6;">
      Generated by RPA Control Center &nbsp;·&nbsp; Period: ${formatDateDMY(v.period.from)} – ${formatDateDMY(v.period.to)}<br>
      Avg run duration across all bots: ${fmtDuration(stats.avgDurationSec)}
    </p>
  </div>
</div>
</body></html>`;
}

export async function sendDigestEmail(payload: DigestEmailPayload): Promise<void> {
  const { ownerEmail, ownerName, period, stats, bots } = payload;
  const periodLabel = formatPeriod(period.from, period.to);

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      ownerEmail,
    subject: `[RPA Report] Digest — ${periodLabel} (${formatDateDMY(period.from)} – ${formatDateDMY(period.to)})`,
    html:    buildDigestEmailHtml({
      ownerName, ownerEmail, period, stats, bots, periodLabel, dashboardUrl: appUrl(),
    }),
  });

  if (error) throw new Error(`Resend delivery error: ${error.message}`);
}
