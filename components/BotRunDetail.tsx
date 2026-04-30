"use client";

import { useState, useEffect, useMemo } from "react";

interface RunRecord {
  transactionId: string;
  status: string;
  startTime: string;
  endTime: string | null;
  durationSec: number;
  runBy: string | null;
  errorCode: string | null;
  isLateStart: boolean;
  isSLABreach: boolean;
  errorDetail: {
    errorMessage: string;
    screenshotPath: string;
    errorCode: string | null;
  } | null;
}

type RunFilter = "All" | "Success" | "Failed" | "SLABreach" | "LateStart";

function resolveStatus(run: RunRecord): "Success" | "Failed" | "SLABreach" | "LateStart" {
  if (run.status === "Failed") return "Failed";
  if (run.isSLABreach) return "SLABreach";
  if (run.isLateStart) return "LateStart";
  return "Success";
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const STATUS_CFG = {
  Success:   { label: "Success",    text: "text-emerald-300", bg: "bg-emerald-900/40", border: "border-emerald-700" },
  Failed:    { label: "Failed",     text: "text-red-300",     bg: "bg-red-900/40",     border: "border-red-700"     },
  SLABreach: { label: "SLA Breach", text: "text-orange-300",  bg: "bg-orange-900/40",  border: "border-orange-700"  },
  LateStart: { label: "Late Start", text: "text-yellow-300",  bg: "bg-yellow-900/40",  border: "border-yellow-700"  },
} as const;

const FILTER_ACTIVE: Record<RunFilter, string> = {
  All:       "bg-gray-700 text-gray-100 border-gray-500",
  Success:   "bg-emerald-900/60 text-emerald-300 border-emerald-600",
  Failed:    "bg-red-900/60 text-red-300 border-red-600",
  SLABreach: "bg-orange-900/60 text-orange-300 border-orange-600",
  LateStart: "bg-yellow-900/60 text-yellow-300 border-yellow-600",
};

const FILTER_LABELS: Record<RunFilter, string> = {
  All: "All", Success: "Success", Failed: "Failed",
  SLABreach: "SLA Breach", LateStart: "Late Start",
};

// Rotate through muted error-tone colors for visual variety across bubbles
const BUBBLE_PALETTE = [
  "bg-red-950/80   border-red-800    text-red-200",
  "bg-rose-950/80  border-rose-800   text-rose-200",
  "bg-orange-950/80 border-orange-800 text-orange-200",
  "bg-red-900/70   border-red-700    text-red-300",
];

export default function BotRunDetail({ processName }: { processName: string }) {
  const [runs,    setRuns]    = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<RunFilter>("All");

  // Use LOCAL date — getUTCDate() would give yesterday for ICT before 07:00
  const today = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    setLoading(true);
    setFilter("All");
    fetch(`/api/runs/${encodeURIComponent(processName)}?from=${today}&to=${today}`)
      .then(r => r.ok ? r.json() : [])
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [processName, today]);

  // Group failed runs by error message for the bubble chart
  const errorBubbles = useMemo(() => {
    const map = new Map<string, { message: string; code: string | null; count: number }>();
    for (const run of runs) {
      const msg = run.errorDetail?.errorMessage;
      if (!msg) continue;
      const existing = map.get(msg);
      if (existing) {
        existing.count++;
      } else {
        map.set(msg, {
          message: msg,
          code: run.errorCode ?? run.errorDetail?.errorCode ?? null,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [runs]);

  const maxCount = errorBubbles[0]?.count ?? 1;

  const counts = useMemo((): Record<RunFilter, number> => ({
    All:       runs.length,
    Success:   runs.filter(r => resolveStatus(r) === "Success").length,
    Failed:    runs.filter(r => resolveStatus(r) === "Failed").length,
    SLABreach: runs.filter(r => resolveStatus(r) === "SLABreach").length,
    LateStart: runs.filter(r => resolveStatus(r) === "LateStart").length,
  }), [runs]);

  const visibleRuns = useMemo(() =>
    filter === "All" ? runs : runs.filter(r => resolveStatus(r) === filter),
    [runs, filter]
  );

  const base = "bg-gray-950/50 border-t border-gray-800/60";

  if (loading) {
    return <div className={`${base} px-5 py-3 text-[11px] text-gray-600 animate-pulse`}>Loading runs…</div>;
  }
  if (runs.length === 0) {
    return <div className={`${base} px-5 py-3 text-[11px] text-gray-600 italic`}>No runs recorded today.</div>;
  }

  return (
    <div className={base}>

      {/* ── Error bubble chart ─────────────────────────────────────────────── */}
      {errorBubbles.length > 0 && (
        <div className="px-5 pt-4 pb-3 border-b border-gray-800/40">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-3">
            Error frequency · bubble size = occurrences
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            {errorBubbles.map(({ message, code, count }, idx) => {
              const ratio     = count / maxCount;
              const size      = Math.round(48 + ratio * 56);   // 48 → 104 px
              const colorCls  = BUBBLE_PALETTE[idx % BUBBLE_PALETTE.length];
              // Short label: prefer error code, else strip leading "ErrorType: " prefix
              const shortLabel = code ?? message.replace(/^[\w.]+:\s*/, "").slice(0, 18);
              return (
                <div
                  key={message}
                  title={`${message}\n(${count} occurrence${count !== 1 ? "s" : ""})`}
                  className={`flex flex-col items-center justify-center rounded-full border shrink-0
                              cursor-default select-none transition-transform hover:scale-110 ${colorCls}`}
                  style={{ width: size, height: size }}
                >
                  <span className="text-[12px] font-bold leading-none">{count}×</span>
                  {size >= 66 && (
                    <span
                      className="text-[7px] mt-0.5 opacity-60 text-center leading-tight px-1 line-clamp-2"
                      style={{ maxWidth: size - 10 }}
                    >
                      {shortLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Status filter chips ─────────────────────────────────────────────── */}
      <div className="px-5 py-2 border-b border-gray-800/40 flex items-center gap-1.5 flex-wrap">
        {(["All", "Success", "Failed", "SLABreach", "LateStart"] as RunFilter[]).map(f => {
          if (f !== "All" && counts[f] === 0) return null;
          return (
            <button
              key={f}
              onClick={e => { e.stopPropagation(); setFilter(f); }}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                filter === f
                  ? FILTER_ACTIVE[f]
                  : "bg-transparent text-gray-600 border-gray-800 hover:border-gray-600 hover:text-gray-400"
              }`}
            >
              {FILTER_LABELS[f]}
              {f !== "All" && <span className="ml-1 opacity-70">{counts[f]}</span>}
            </button>
          );
        })}
        {filter !== "All" && (
          <span className="text-[9px] text-gray-700 ml-1">{visibleRuns.length} of {runs.length}</span>
        )}
      </div>

      {/* ── Individual run rows ─────────────────────────────────────────────── */}
      <div className="divide-y divide-gray-800/30 max-h-48 overflow-y-auto">
        {visibleRuns.length === 0 ? (
          <p className="px-5 py-3 text-[11px] text-gray-600 italic">
            No {FILTER_LABELS[filter]} runs today.
          </p>
        ) : visibleRuns.map(run => {
          const st  = resolveStatus(run);
          const cfg = STATUS_CFG[st];
          const time = new Date(run.startTime).toLocaleTimeString("en-US", {
            timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false,
          });
          return (
            <div key={run.transactionId} className="px-5 py-2 flex items-center gap-3 min-w-0">
              <span className="font-mono text-[11px] text-gray-500 shrink-0 w-10">{time}</span>
              <span className="font-mono text-[11px] text-gray-400 shrink-0 w-14">{fmtDur(run.durationSec)}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                {cfg.label}
              </span>
              {run.errorDetail?.errorMessage ? (
                <span className="text-[11px] text-gray-600 truncate" title={run.errorDetail.errorMessage}>
                  {run.errorDetail.errorMessage.slice(0, 90)}
                </span>
              ) : run.runBy ? (
                <span className="text-[10px] text-gray-700 ml-auto shrink-0">by {run.runBy}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
