"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ErrorDetailRecord {
  errorMessage: string;
  screenshotPath: string;
  errorCode: string | null;
}

interface RunRecord {
  transactionId: string;
  processName: string;
  status: string;
  startTime: string;
  endTime: string | null;
  durationSec: number;
  runBy: string | null;
  errorCode: string | null;
  isLateStart: boolean;
  isSLABreach: boolean;
  createdAt: string;
  errorDetail: ErrorDetailRecord | null;
}

type RunStatus = "Success" | "Failed" | "SLABreach" | "LateStart";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function resolveStatus(run: RunRecord): RunStatus {
  if (run.status === "Failed") return "Failed";
  if (run.isSLABreach) return "SLABreach";
  if (run.isLateStart) return "LateStart";
  return "Success";
}

const STATUS_STYLES: Record<RunStatus, { bg: string; text: string; border: string; label: string }> = {
  Success:   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600", label: "Success"   },
  Failed:    { bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-600",     label: "Failed"    },
  SLABreach: { bg: "bg-orange-900/40",  text: "text-orange-300",  border: "border-orange-600",  label: "SLA Breach"},
  LateStart: { bg: "bg-yellow-900/40",  text: "text-yellow-300",  border: "border-yellow-600",  label: "Late Start"},
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProcessBacklogPage() {
  const params      = useParams();
  const router      = useRouter();
  const processName = decodeURIComponent(params.processName as string);

  const [runs,     setRuns]     = useState<RunRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function fetchRuns() {
    setLoading(true);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(processName)}`);
      if (res.ok) setRuns(await res.json());
      else setRuns([]);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRuns(); }, [processName]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Summary counts ──────────────────────────────────────────────────────────
  const total    = runs.length;
  const failed   = runs.filter((r) => r.status === "Failed").length;
  const success  = total - failed;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Back + refresh ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Dashboard
        </button>
        <button
          onClick={fetchRuns}
          className="p-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-white break-all">{processName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Run history · sorted newest first</p>
      </div>

      {/* ── Mini KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Total Runs</p>
          <p className="mt-1 text-2xl font-bold text-gray-100">{total}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Success Rate</p>
          <p className={`mt-1 text-2xl font-bold ${successRate >= 90 ? "text-emerald-400" : successRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
            {total > 0 ? `${successRate}%` : "—"}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Failed</p>
          <p className={`mt-1 text-2xl font-bold ${failed > 0 ? "text-red-400" : "text-gray-400"}`}>{failed}</p>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-500 animate-pulse">
          Loading runs…
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-500">
          No runs recorded for this process.
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Date / Time</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Run By</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Duration</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Error Code</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => {
                const status  = resolveStatus(run);
                const cfg     = STATUS_STYLES[status];
                const isFailed = run.status === "Failed";
                const isOpen  = expanded.has(run.transactionId);
                const rowBg   = i % 2 === 0 ? "" : "bg-gray-800/20";

                return (
                  <React.Fragment key={run.transactionId}>
                    {/* ── Main row ──────────────────────────────────────────── */}
                    <tr
                      className={`border-b border-gray-800/50 ${rowBg} ${isFailed ? "cursor-pointer hover:bg-red-950/20" : ""} transition-colors`}
                      onClick={isFailed ? () => toggleExpanded(run.transactionId) : undefined}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                        {fmtDateTime(run.startTime)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {run.runBy ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-300">
                        {fmtDuration(Math.round(run.durationSec))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {run.errorCode
                          ? <span className="text-orange-300">{run.errorCode}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {isFailed && (
                          isOpen
                            ? <ChevronDown size={13} className="text-red-400 mx-auto" />
                            : <ChevronRight size={13} className="text-gray-600 mx-auto" />
                        )}
                      </td>
                    </tr>

                    {/* ── Accordion: error detail ────────────────────────────── */}
                    {isFailed && isOpen && (
                      <tr className="border-b border-gray-800/50">
                        <td colSpan={6} className="bg-red-950/25 px-6 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400 mb-2">
                            Error Detail
                          </p>
                          <p className="text-sm text-red-200 whitespace-pre-wrap break-words leading-relaxed">
                            {run.errorDetail?.errorMessage ?? "No error message recorded."}
                          </p>
                          {run.errorDetail?.screenshotPath && (
                            <a
                              href={run.errorDetail.screenshotPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all"
                            >
                              {run.errorDetail.screenshotPath}
                            </a>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
