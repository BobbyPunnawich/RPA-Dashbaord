"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, CalendarDays } from "lucide-react";
import TodaySummary from "@/components/TodaySummary";
import MatrixGrid from "@/components/MatrixGrid";
import { DashboardStats, ProcessMatrix, ProcessDefinition } from "@/types/rpa";

// Date input state always holds AD (Gregorian) "YYYY-MM-DD" so HTML date pickers work correctly.
// PAD stores timestamps with Buddhist Era year (พ.ศ. = AD + 543), e.g. "2569-04-29T13:18:00Z".
// toBEParam() converts an AD date string to BE before it is sent to the API.
function toAdDateStr(d: Date) {
  const y   = d.getUTCFullYear();
  const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toBEParam(adDate: string) {
  const [y, m, d] = adDate.split("-");
  return `${parseInt(y, 10) + 543}-${m}-${d}`;
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Today-only stats + matrix for KPI cards + chart ─────────────────────────
  const fetchTodayStats = useCallback(async () => {
    setLoadingToday(true);
    const todayBE = toBEParam(toAdDateStr(new Date())); // AD→BE for DB query
    const params  = new URLSearchParams({ from: todayBE, to: todayBE });
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
      from: toBEParam(range.from), to: toBEParam(range.to), // AD→BE for DB query
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

  function handleRefresh() { setRefreshKey((k) => k + 1); }

  const _now      = new Date();
  const _beYear   = _now.getUTCFullYear() + 543;
  const todayLabel = `${_now.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  })} พ.ศ. ${_beYear}`;

  return (
    <div className="space-y-6">

      {/* ── Today's Summary ────────────────────────────────────────────────── */}
      <section>
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

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
      </div>

      {/* ── Operational Matrix ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold text-white">Operational Matrix</h2>
          <span className="text-xs text-gray-600">{toBEParam(range.from)} → {toBEParam(range.to)}</span>
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
    </div>
  );
}
