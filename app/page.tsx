"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, CalendarDays } from "lucide-react";
import KpiCards from "@/components/KpiCards";
import MatrixGrid from "@/components/MatrixGrid";
import { DashboardStats, ProcessMatrix, ProcessDefinition } from "@/types/rpa";

function toDateInput(d: Date) {
  return d.toISOString().split("T")[0];
}
function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInput(from), to: toDateInput(to) };
}

interface DashboardData {
  stats: DashboardStats;
  matrix: ProcessMatrix[];
  totalDays: number;
  startDate: string;
  endDate: string;
}

export default function DashboardPage() {
  const [range, setRange]                   = useState(defaultRange);
  const [search, setSearch]                 = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [data, setData]                     = useState<DashboardData | null>(null);
  const [processes, setProcesses]           = useState<ProcessDefinition[]>([]);
  const [loadingDash, setLoadingDash]       = useState(true);
  const [refreshKey, setRefreshKey]         = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(async () => {
    setLoadingDash(true);
    const params = new URLSearchParams({ from: range.from, to: range.to, ...(debouncedSearch && { search: debouncedSearch }) });
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

  useEffect(() => { fetchDashboard(); }, [fetchDashboard, refreshKey]);
  useEffect(() => { fetchProcesses(); }, [fetchProcesses, refreshKey]);

  function handleRefresh() { setRefreshKey((k) => k + 1); }

  const stats = data?.stats ?? { totalRuns: 0, successRate: 0, slaCompliance: 100, avgDurationSec: 0 };

  return (
    <div className="space-y-6">
      {/* ── Filters ─────────────────────────────────────────────────────────── */}
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
            type="text" placeholder="Search by bot name or owner…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-600 hover:text-gray-300 text-xs leading-none">×</button>
          )}
        </div>

        <button
          onClick={handleRefresh}
          title="Refresh data"
          className="ml-auto p-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={15} className={loadingDash ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <KpiCards stats={stats} />

      {/* ── Matrix ────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold text-white">Operational Matrix</h2>
          <span className="text-xs text-gray-600">{range.from} → {range.to}</span>
          {loadingDash && <span className="text-xs text-indigo-400 animate-pulse">Updating…</span>}
        </div>
        <MatrixGrid
          matrix={data?.matrix ?? []}
          totalDays={data?.totalDays ?? 31}
          startDate={data?.startDate ?? new Date(range.from).toISOString()}
          processes={processes}
          onRefresh={handleRefresh}
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
