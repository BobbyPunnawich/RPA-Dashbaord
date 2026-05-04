"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw, Pencil, Check, X, Download } from "lucide-react";
import { downloadXlsx } from "@/lib/exportXlsx";
import { ProcessDefinition } from "@/types/rpa";
import ErrorBubbleChart from "@/components/ErrorBubbleChart";
import DailyRunChart from "@/components/DailyRunChart";

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
  // Display in UTC: PAD sends ICT local time without a proper offset, so the stored
  // UTC value IS the correct local time. No extra conversion needed.
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
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
  Success:   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600", label: "Success"    },
  Failed:    { bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-600",     label: "Failed"     },
  SLABreach: { bg: "bg-orange-900/40",  text: "text-orange-300",  border: "border-orange-600",  label: "SLA Breach" },
  LateStart: { bg: "bg-yellow-900/40",  text: "text-yellow-300",  border: "border-yellow-600",  label: "Late Start" },
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProcessBacklogPage() {
  const params        = useParams();
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const processName   = decodeURIComponent(params.processName as string);
  // ?tx=<transactionId> deep-link from failure email — auto-expand that row
  const initialTx     = searchParams.get("tx") ?? null;

  const [runs,       setRuns]       = useState<RunRecord[]>([]);
  const [processDef, setProcessDef] = useState<ProcessDefinition | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [todayCount, setTodayCount] = useState(0);
  const deepLinkRowRef = useRef<HTMLTableRowElement | null>(null);

  // ── SLA inline-edit state ──────────────────────────────────────────────────
  const [editingSLA, setEditingSLA] = useState(false);
  const [slaInput,   setSlaInput]   = useState("");
  const [slaSaving,  setSlaSaving]  = useState(false);
  const [slaError,   setSlaError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, procsRes] = await Promise.all([
        fetch(`/api/runs/${encodeURIComponent(processName)}`),
        fetch("/api/processes"),
      ]);
      if (runsRes.ok) setRuns(await runsRes.json());
      else            setRuns([]);
      if (procsRes.ok) {
        const procs: ProcessDefinition[] = await procsRes.json();
        const found = procs.find((p) => p.processName === processName) ?? null;
        setProcessDef(found);
        if (found) setSlaInput(String(found.slaMaxDuration));
      }
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [processName]);

  // Fetch today's run count using Gregorian (CE) date.
  const fetchTodayCount = useCallback(async () => {
    const now = new Date();
    const today =
      `${now.getUTCFullYear()}-` +
      `${String(now.getUTCMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getUTCDate()).padStart(2, "0")}`;
    console.log("[fetchTodayCount] today string sent to API:", today);
    try {
      const res = await fetch(
        `/api/runs/${encodeURIComponent(processName)}?from=${today}&to=${today}`
      );
      if (res.ok) {
        const todayRuns: RunRecord[] = await res.json();
        setTodayCount(todayRuns.length);
      }
    } catch { /* non-critical */ }
  }, [processName]);

  useEffect(() => { fetchData(); fetchTodayCount(); }, [fetchData, fetchTodayCount]);

  // When arriving via a deep-link (?tx=...), auto-expand and scroll to that row
  // after runs finish loading.
  useEffect(() => {
    if (!initialTx || loading || runs.length === 0) return;
    setExpanded((prev) => {
      if (prev.has(initialTx)) return prev;
      return new Set([...prev, initialTx]);
    });
    // Defer scroll until after React paints the expanded accordion row
    requestAnimationFrame(() => {
      deepLinkRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [initialTx, loading, runs]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveSLA() {
    if (!processDef) return;
    const sec = parseInt(slaInput, 10);
    if (isNaN(sec) || sec < 1) { setSlaError("Enter a valid number of seconds"); return; }
    setSlaSaving(true); setSlaError(null);
    try {
      const res = await fetch(`/api/processes/${processDef.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slaMaxDuration: sec }),
      });
      if (res.ok) {
        const updated: ProcessDefinition = await res.json();
        setProcessDef(updated);
        setSlaInput(String(updated.slaMaxDuration));
        setEditingSLA(false);
      } else {
        setSlaError((await res.json()).error ?? "Save failed");
      }
    } catch { setSlaError("Network error"); }
    finally  { setSlaSaving(false); }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total       = runs.length;
  const failed      = runs.filter((r) => r.status === "Failed").length;
  const success     = total - failed;
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
  const avgDuration = total > 0
    ? Math.round(runs.reduce((s, r) => s + r.durationSec, 0) / total)
    : 0;


  function handleExport() {
    const rows = runs.map((run) => ({
      "Transaction ID":  run.transactionId,
      "Start Time":      fmtDateTime(run.startTime),
      "End Time":        run.endTime ? fmtDateTime(run.endTime) : "—",
      "Duration":        fmtDuration(Math.round(run.durationSec)),
      "Duration (s)":    Math.round(run.durationSec),
      "Run By":          run.runBy ?? "—",
      "Status":          resolveStatus(run),
      "Late Start":      run.isLateStart  ? "Yes" : "No",
      "SLA Breach":      run.isSLABreach  ? "Yes" : "No",
      "Error Code":      run.errorCode    ?? "—",
      "Error Message":   run.errorDetail?.errorMessage ?? "—",
      "Screenshot Path": run.errorDetail?.screenshotPath ?? "—",
    }));
    const safeName = processName.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadXlsx([{ name: "Run History", rows }], `RPA_${safeName}_RunHistory`);
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={loading || runs.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 text-sm font-medium transition-colors"
            title="Export run history to Excel"
          >
            <Download size={14} />
            <span>Export XLSX</span>
          </button>
          <button
            onClick={() => { fetchData(); fetchTodayCount(); }}
            className="p-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-white break-all">{processName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Run history · sorted newest first</p>
      </div>

      {/* ── SLA not configured banner ────────────────────────────────────────── */}
      {processDef && processDef.slaMaxDuration === 0 && !editingSLA && (
        <div className="flex items-center justify-between gap-4 bg-amber-900/25 border border-amber-700/50 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-amber-400">SLA not configured</p>
            <p className="text-[11px] text-amber-300/70 mt-0.5">
              Set the max allowed run duration so the system can detect SLA breaches for this bot.
            </p>
          </div>
          <button
            onClick={() => { setSlaInput(""); setEditingSLA(true); setSlaError(null); }}
            className="shrink-0 text-xs font-semibold text-amber-300 border border-amber-600/60 hover:border-amber-400 hover:text-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Set SLA
          </button>
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div id="tour-process-kpis" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Total Runs</p>
          <p className="mt-1 text-2xl font-bold text-gray-100">{total}</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Today&apos;s Runs</p>
          <p className={`mt-1 text-2xl font-bold ${todayCount > 0 ? "text-indigo-400" : "text-gray-600"}`}>
            {todayCount}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">of {total} total</p>
        </div>


        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Success Rate</p>
          <p className={`mt-1 text-2xl font-bold ${
            successRate >= 90 ? "text-emerald-400" : successRate >= 70 ? "text-yellow-400" : "text-red-400"
          }`}>
            {total > 0 ? `${successRate}%` : "—"}
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Failed</p>
          <p className={`mt-1 text-2xl font-bold ${failed > 0 ? "text-red-400" : "text-gray-400"}`}>{failed}</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Avg Run Time</p>
          <p className="mt-1 text-2xl font-bold text-indigo-400">
            {total > 0 ? fmtDuration(avgDuration) : "—"}
          </p>
        </div>

        {/* SLA Max — inline editable */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">SLA Max</p>
            {!editingSLA && processDef && (
              <button
                onClick={() => { setSlaInput(String(processDef.slaMaxDuration)); setEditingSLA(true); setSlaError(null); }}
                title="Edit SLA"
                className="text-gray-600 hover:text-indigo-400 transition-colors"
              >
                <Pencil size={11} />
              </button>
            )}
          </div>

          {editingSLA ? (
            <div className="mt-2 space-y-1.5">
              <input
                type="number" min={1}
                value={slaInput}
                onChange={(e) => setSlaInput(e.target.value)}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                placeholder="seconds"
              />
              <p className="text-[10px] text-gray-500">
                {isNaN(parseInt(slaInput, 10)) ? "—" : fmtDuration(parseInt(slaInput, 10))}
              </p>
              {slaError && <p className="text-[10px] text-red-400">{slaError}</p>}
              <div className="flex gap-1.5">
                <button onClick={saveSLA} disabled={slaSaving}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold transition-colors">
                  <Check size={10} />{slaSaving ? "…" : "Save"}
                </button>
                <button onClick={() => { setEditingSLA(false); setSlaError(null); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] transition-colors">
                  <X size={10} />Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-2xl font-bold text-blue-400">
              {processDef ? fmtDuration(processDef.slaMaxDuration) : "—"}
            </p>
          )}
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      {!loading && runs.length > 0 && (
        <div id="tour-process-charts" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailyRunChart runs={runs} />
          <ErrorBubbleChart runs={runs} />
        </div>
      )}

      {/* ── Run table ───────────────────────────────────────────────────────── */}
      <div id="tour-process-runs">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">Start Time</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">End Time</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Run By</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Duration</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Error Code</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => {
                  const status   = resolveStatus(run);
                  const cfg      = STATUS_STYLES[status];
                  const isFailed = run.status === "Failed";
                  const isOpen   = expanded.has(run.transactionId);
                  const rowBg    = i % 2 === 0 ? "" : "bg-gray-800/20";

                  const isDeepLinked = run.transactionId === initialTx;

                  return (
                    <React.Fragment key={run.transactionId}>
                      <tr
                        ref={isDeepLinked ? deepLinkRowRef : null}
                        className={`border-b border-gray-800/50 ${rowBg} ${isFailed ? "cursor-pointer hover:bg-red-950/20" : ""} ${isDeepLinked ? "ring-1 ring-inset ring-indigo-500/60" : ""} transition-colors`}
                        onClick={isFailed ? () => toggleExpanded(run.transactionId) : undefined}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-300 whitespace-nowrap">
                          {fmtDateTime(run.startTime)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                          {run.endTime
                            ? fmtDateTime(run.endTime)
                            : <span className="text-gray-600">—</span>}
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

                      {/* ── Error accordion ────────────────────────────────── */}
                      {isFailed && isOpen && (
                        <tr className="border-b border-gray-800/50">
                          <td colSpan={7} className="bg-red-950/25 px-6 py-4">
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
        </div>
      )}
      </div>{/* /tour-process-runs */}
    </div>
  );
}
