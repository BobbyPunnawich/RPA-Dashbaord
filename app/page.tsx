"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, RefreshCw, CalendarDays, AlertTriangle, X, Send, Download } from "lucide-react";
import { downloadXlsx } from "@/lib/exportXlsx";
import TodaySummary from "@/components/TodaySummary";
import MatrixGrid from "@/components/MatrixGrid";
import IssuesTable, { IssueErrorInfo } from "@/components/IssuesTable";
import ErrorModal from "@/components/ErrorModal";
import DigestReportModal from "@/components/DigestReportModal";
import { DashboardStats, ProcessMatrix, ProcessDefinition } from "@/types/rpa";

// Date input state holds AD (Gregorian) "YYYY-MM-DD". All DB records are CE after the fix-dates migration.
function toAdDateStr(d: Date) {
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Use LOCAL date (not UTC) for "today" — in Thailand (UTC+7), getUTCDate() returns
// yesterday when the local time is between midnight and 7 am ICT.
function toLocalDateStr(d: Date) {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function defaultRange() {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const mo  = now.getUTCMonth();
  return {
    from: toAdDateStr(new Date(Date.UTC(y, mo, 1))),
    to:   toAdDateStr(new Date(Date.UTC(y, mo + 1, 0))),
  };
}

interface DashboardData {
  stats: DashboardStats;
  matrix: ProcessMatrix[];
  totalDays: number;
  startDate: string;
  endDate: string;
  allTimeCounts: Record<string, number>;
}

interface AlertToast {
  id: string;
  message: string;
  names: string[];
}

const EMPTY_STATS: DashboardStats = {
  totalRuns: 0, successRate: 0, slaCompliance: 100, avgDurationSec: 0,
  breakdown: { success: 0, lateStart: 0, slaBreach: 0, failed: 0, slaIssues: 0 },
};

export default function DashboardPage() {
  const [range, setRange]                       = useState(defaultRange);
  const [search, setSearch]                     = useState("");
  const [debouncedSearch, setDebouncedSearch]   = useState("");
  const [data, setData]                         = useState<DashboardData | null>(null);
  const [todayStats, setTodayStats]             = useState<DashboardStats | null>(null);
  const [todayMatrix, setTodayMatrix]           = useState<ProcessMatrix[] | null>(null);
  const [processes, setProcesses]               = useState<ProcessDefinition[]>([]);
  const [loadingDash, setLoadingDash]           = useState(true);
  const [loadingToday, setLoadingToday]         = useState(true);
  const [refreshKey, setRefreshKey]             = useState(0);
  const [toasts, setToasts]                     = useState<AlertToast[]>([]);
  const [modalError, setModalError]             = useState<IssueErrorInfo | null>(null);
  const [showDigest, setShowDigest]             = useState(false);
  const seenIssueIds                            = useRef<Set<string>>(new Set());
  const hasLoadedOnce                           = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Today-only stats + matrix for KPI cards + chart ─────────────────────────
  const fetchTodayStats = useCallback(async () => {
    setLoadingToday(true);
    const today  = toLocalDateStr(new Date());   // local date, not UTC
    const params = new URLSearchParams({ from: today, to: today });
    try {
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTodayStats(json.stats);
        setTodayMatrix(json.matrix);
      } else {
        console.error("[fetchTodayStats] API error", res.status, await res.text().catch(() => ""));
      }
    } catch (e) {
      console.error("[fetchTodayStats] fetch failed", e);
    } finally { setLoadingToday(false); }
  }, []);

  // ── Matrix data (user-selected date range) ───────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoadingDash(true);
    const params = new URLSearchParams({
      from: range.from, to: range.to,
      ...(debouncedSearch && { search: debouncedSearch }),
    });
    try {
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) setData(await res.json());
      else setData(null);
    } catch { setData(null); }
    finally { setLoadingDash(false); }
  }, [range.from, range.to, debouncedSearch]);

  const fetchProcesses = useCallback(async () => {
    try {
      const res = await fetch("/api/processes");
      if (res.ok) setProcesses(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchTodayStats(); },  [fetchTodayStats,  refreshKey]);
  useEffect(() => { fetchDashboard(); },   [fetchDashboard,   refreshKey]);
  useEffect(() => { fetchProcesses(); },   [fetchProcesses,   refreshKey]);

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Detect new issues when today's matrix updates
  useEffect(() => {
    if (!todayMatrix) return;

    const newNames: string[] = [];
    for (const { processName, cells } of todayMatrix) {
      for (const cell of cells) {
        if (cell.status === "None" || cell.status === "Success") continue;
        if (!cell.transactionId) continue;
        if (seenIssueIds.current.has(cell.transactionId)) continue;
        seenIssueIds.current.add(cell.transactionId);
        if (hasLoadedOnce.current) newNames.push(processName);
      }
    }
    hasLoadedOnce.current = true;

    if (newNames.length === 0) return;

    const message =
      newNames.length === 1
        ? `${newNames[0]} has a new issue`
        : `${newNames.length} bots have new issues`;

    // Browser notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("RPA Control Center — Issue Detected", {
        body: message,
        icon: "/favicon.ico",
      });
    }

    // In-app toast
    const toastId = `${Date.now()}`;
    setToasts((prev) => [...prev, { id: toastId, message, names: newNames }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 7000);
  }, [todayMatrix]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleRefresh() { setRefreshKey((k) => k + 1); }

  function handleExport() {
    if (!data) return;

    // Sheet 1: one row per bot (summary)
    const summaryRows = data.matrix.map(({ processName, cells }) => {
      const proc = processes.find((p) => p.processName === processName);
      const activeCells = cells.filter((c) => c.runCount > 0);
      const totalRuns   = cells.reduce((s, c) => s + c.runCount, 0);
      const successDays = cells.filter((c) => c.status === "Success").length;
      const failedDays  = cells.filter((c) => c.status === "Failed").length;
      const slaDays     = cells.filter((c) => c.status === "SLABreach").length;
      const lateDays    = cells.filter((c) => c.status === "LateStart").length;
      const successRate = activeCells.length > 0
        ? Math.round((successDays / activeCells.length) * 100)
        : 100;
      return {
        "Bot Name":          processName,
        "Owner":             proc?.owner      ?? "—",
        "Bot Type":          proc?.botType    ?? "—",
        "SLA Max (s)":       proc?.slaMaxDuration ?? 0,
        "Total Runs":        totalRuns,
        "Active Days":       activeCells.length,
        "Success Days":      successDays,
        "Failed Days":       failedDays,
        "SLA Breach Days":   slaDays,
        "Late Start Days":   lateDays,
        "Success Rate (%)":  successRate,
        "Period From":       range.from,
        "Period To":         range.to,
      };
    });

    // Sheet 2: one row per bot per active day
    const dailyRows = data.matrix.flatMap(({ processName, cells }) => {
      const proc = processes.find((p) => p.processName === processName);
      return cells
        .filter((c) => c.runCount > 0)
        .map((c) => ({
          "Bot Name":       processName,
          "Owner":          proc?.owner ?? "—",
          "Date":           c.dateLabel,
          "Runs":           c.runCount,
          "Day Status":     c.status,
          "Duration (s)":   c.durationSec ?? "—",
          "Volume":         c.volumeCount ?? "—",
          "Transaction ID": c.transactionId ?? "—",
        }));
    });

    const safeFrom = range.from.replace(/-/g, "");
    const safeTo   = range.to.replace(/-/g, "");
    downloadXlsx(
      [
        { name: "Bot Summary",  rows: summaryRows },
        { name: "Daily Detail", rows: dailyRows   },
      ],
      `RPA_Dashboard_${safeFrom}_${safeTo}`,
    );
  }

  const _now      = new Date();
  const _beYear   = _now.getUTCFullYear() + 543;
  const todayLabel = `${_now.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  })} พ.ศ. ${_beYear}`;

  return (
    <div className="space-y-6">

      {/* ── Today's Summary ────────────────────────────────────────────────── */}
      <section id="tour-today-summary">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold text-white">Today&apos;s Summary</h2>
          <span className="text-xs text-gray-600">{todayLabel}</span>
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="ml-auto p-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={15} className={loadingDash ? "animate-spin" : ""} />
          </button>
        </div>
        <TodaySummary
          stats={todayStats ?? EMPTY_STATS}
          todayMatrix={todayMatrix}
          processes={processes}
          loading={loadingToday}
        />
      </section>

      {/* ── Issues Summary ─────────────────────────────────────────────────── */}
      {/* Wrapper always in DOM so the tour can reference it even when empty   */}
      <div id="tour-issues">
        {!loadingToday && (
          <IssuesTable
            todayMatrix={todayMatrix}
            processes={processes}
            stats={todayStats}
            onErrorClick={setModalError}
          />
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div id="tour-filters" className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2">
          <CalendarDays size={15} className="text-gray-500 shrink-0" />
          <input
            type="date" value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="bg-transparent text-sm text-gray-200 focus:outline-none"
          />
          <span className="text-gray-600 text-sm">→</span>
          <input
            type="date" value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="bg-transparent text-sm text-gray-200 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            type="text" placeholder="Search bots…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-600 hover:text-gray-300 text-xs leading-none">×</button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <button
            onClick={handleExport}
            disabled={!data || loadingDash}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40 text-sm font-medium transition-colors"
            title="Export matrix data to Excel"
          >
            <Download size={14} />
            <span>Export XLSX</span>
          </button>
          <button
            onClick={() => setShowDigest(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-700/50 bg-indigo-900/20 text-indigo-300 hover:bg-indigo-800/40 hover:text-white text-sm font-medium transition-colors"
            title="Send a bot performance digest to owners"
          >
            <Send size={14} />
            <span>Send Report to My Email</span>
          </button>
        </div>
      </div>

      {showDigest && (
        <DigestReportModal
          initialFrom={range.from}
          initialTo={range.to}
          onClose={() => setShowDigest(false)}
        />
      )}

      {/* ── Operational Matrix ─────────────────────────────────────────────── */}
      <section id="tour-matrix">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold text-white">Operational Matrix</h2>
          <span className="text-xs text-gray-600">{range.from} → {range.to}</span>
          {loadingDash && <span className="text-xs text-indigo-400 animate-pulse">Updating…</span>}
        </div>
        <MatrixGrid
          matrix={data?.matrix ?? []}
          totalDays={data?.totalDays ?? 31}
          startDate={data?.startDate ?? new Date(range.from).toISOString()}
          fromDate={range.from}
          toDate={range.to}
          allTimeCounts={data?.allTimeCounts ?? {}}
          processes={processes}
          onRefresh={handleRefresh}
          loading={loadingDash}
        />
      </section>

      {!data && !loadingDash && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-5 py-4 text-sm text-yellow-300">
          <strong>Could not load dashboard data.</strong> Verify <code>DATABASE_URL</code> in <code>.env</code>.
        </div>
      )}

      {/* ── Error Detail Modal ─────────────────────────────────────────────── */}
      {modalError && (
        <ErrorModal
          transactionId={modalError.transactionId}
          processName={modalError.processName}
          day={1}
          errorMessage={modalError.errorMessage}
          screenshotPath={modalError.screenshotPath}
          onClose={() => setModalError(null)}
        />
      )}

      {/* ── Alert Toasts ───────────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 bg-red-950/95 border border-red-700 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm"
            >
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-200">Issue Detected</p>
                <p className="text-xs text-red-300/80 mt-0.5">{toast.message}</p>
                {toast.names.length > 1 && (
                  <p className="text-[10px] text-red-400/60 mt-1 truncate">
                    {toast.names.join(", ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-red-500 hover:text-red-300 transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
