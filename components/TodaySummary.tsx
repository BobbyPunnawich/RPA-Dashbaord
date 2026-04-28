"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { DashboardStats, ProcessMatrix, ProcessDefinition, CellStatus } from "@/types/rpa";

const STATUS_CFG: Record<CellStatus, { bg: string; text: string; border: string; label: string; hex: string }> = {
  None:      { bg: "bg-gray-800",       text: "text-gray-500",    border: "border-gray-700",    label: "No Run",     hex: "#374151" },
  Success:   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-700", label: "Success",    hex: "#10b981" },
  LateStart: { bg: "bg-yellow-900/40",  text: "text-yellow-300",  border: "border-yellow-700",  label: "Late Start", hex: "#eab308" },
  SLABreach: { bg: "bg-orange-900/40",  text: "text-orange-300",  border: "border-orange-700",  label: "SLA Breach", hex: "#f97316" },
  Failed:    { bg: "bg-red-900/40",     text: "text-red-300",     border: "border-red-700",     label: "Failed",     hex: "#ef4444" },
};

const BAR_COLOR: Partial<Record<CellStatus, string>> = {
  Success:   "bg-emerald-500",
  LateStart: "bg-yellow-500",
  SLABreach: "bg-orange-500",
  Failed:    "bg-red-500",
};

const STATUS_PRIORITY: Partial<Record<CellStatus, number>> = {
  Failed: 4, SLABreach: 3, LateStart: 2, Success: 1,
};

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 h-[180px]" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 h-[80px]" />
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 h-[140px]" />
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, borderColor, textColor,
}: {
  label: string; value: string; sub?: string; borderColor: string; textColor: string;
}) {
  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 border-l-4 ${borderColor} px-4 py-3.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${textColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  stats: DashboardStats;
  todayMatrix: ProcessMatrix[] | null;
  processes: ProcessDefinition[];
  loading: boolean;
}

export default function TodaySummary({ stats, todayMatrix, processes, loading }: Props) {
  if (loading) return <Skeleton />;

  const processDefMap = new Map(processes.map((p) => [p.processName, p]));

  // Status counts for donut
  const statusCounts: Partial<Record<CellStatus, number>> = {};
  todayMatrix?.forEach(({ cells }) => {
    const cell = cells.find((c) => c.status !== "None");
    if (cell) statusCounts[cell.status] = (statusCounts[cell.status] ?? 0) + 1;
  });

  const pieData = (["Success", "LateStart", "SLABreach", "Failed"] as CellStatus[])
    .filter((s) => (statusCounts[s] ?? 0) > 0)
    .map((s) => ({
      name: STATUS_CFG[s].label,
      value: statusCounts[s]!,
      fill: STATUS_CFG[s].hex,
    }));

  // Per-bot runs today, worst-status first
  const todayRuns = (todayMatrix ?? [])
    .map(({ processName, cells }) => ({
      processName,
      cell: cells.find((c) => c.status !== "None") ?? cells[0],
      def: processDefMap.get(processName),
    }))
    .filter(({ cell }) => cell.status !== "None")
    .sort(
      (a, b) =>
        (STATUS_PRIORITY[b.cell.status] ?? 0) - (STATUS_PRIORITY[a.cell.status] ?? 0)
    );

  const ranNames = new Set(todayRuns.map((r) => r.processName));
  const pendingCount = processes.filter((p) => !ranNames.has(p.processName)).length;

  const failed = Math.max(0, stats.totalRuns - Math.round((stats.successRate / 100) * stats.totalRuns));
  const slaIssues = Math.max(0, stats.totalRuns - Math.round((stats.slaCompliance / 100) * stats.totalRuns));

  return (
    <div className="space-y-4">
      {/* Row 1: Donut + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Donut */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col items-center justify-center min-h-[160px]">
          {pieData.length > 0 ? (
            <>
              <div className="relative w-[152px] h-[152px]">
                <PieChart width={152} height={152}>
                  <Pie
                    data={pieData}
                    cx={71} cy={71}
                    innerRadius={50} outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "#e5e7eb" }}
                  />
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">{stats.totalRuns}</span>
                  <span className="text-[10px] text-gray-500">runs</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                {pieData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                    {d.value} {d.name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center mx-auto mb-2">
                <span className="text-lg text-gray-700">—</span>
              </div>
              <p className="text-xs text-gray-600">No runs today</p>
            </div>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 content-start">
          <MetricCard
            label="Success Rate"
            value={`${stats.successRate}%`}
            sub={stats.totalRuns > 0 ? `${failed} failed` : "No data"}
            borderColor="border-l-emerald-500"
            textColor="text-emerald-400"
          />
          <MetricCard
            label="Avg Run Time"
            value={stats.avgDurationSec > 0 ? fmtDuration(stats.avgDurationSec) : "—"}
            sub="per run"
            borderColor="border-l-indigo-500"
            textColor="text-indigo-400"
          />
          <MetricCard
            label="SLA Compliance"
            value={`${stats.slaCompliance}%`}
            sub={stats.totalRuns > 0 ? `${slaIssues} issue${slaIssues !== 1 ? "s" : ""}` : "No data"}
            borderColor="border-l-blue-500"
            textColor="text-blue-400"
          />
        </div>
      </div>

      {/* Row 2: Per-bot run list */}
      {todayRuns.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Today&apos;s Runs
            </span>
            {pendingCount > 0 && (
              <span className="text-[10px] text-gray-600">
                {pendingCount} bot{pendingCount !== 1 ? "s" : ""} not run yet
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-800/40 max-h-52 overflow-y-auto">
            {todayRuns.map(({ processName, cell, def }) => {
              const slaPct =
                def && cell.durationSec !== undefined
                  ? Math.min((cell.durationSec / def.slaMaxDuration) * 100, 100)
                  : null;
              const barBg = BAR_COLOR[cell.status] ?? "bg-gray-600";
              const badge = STATUS_CFG[cell.status];
              return (
                <div key={processName} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-sm text-gray-200 truncate w-36 shrink-0">{processName}</span>
                  {slaPct !== null ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barBg}`}
                          style={{ width: `${slaPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-400 shrink-0 whitespace-nowrap">
                        {fmtDuration(cell.durationSec!)}
                        {def && (
                          <span className="text-gray-700"> / {fmtDuration(def.slaMaxDuration)}</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
