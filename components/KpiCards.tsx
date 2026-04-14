"use client";

import { DashboardStats } from "@/types/rpa";

interface KpiCardsProps {
  stats: DashboardStats;
}

interface CardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent: string; // tailwind border+text color pair
}

function KpiCard({ label, value, sub, accent }: CardProps) {
  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 border-l-4 ${accent} px-5 py-4 shadow-sm`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent.split(" ")[1]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default function KpiCards({ stats }: KpiCardsProps) {
  const failed = stats.totalRuns - Math.round((stats.successRate / 100) * stats.totalRuns);
  const slaIssues = stats.totalRuns - Math.round((stats.slaCompliance / 100) * stats.totalRuns);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Total Runs"
        value={stats.totalRuns.toLocaleString()}
        sub={`${failed} failed`}
        accent="border-gray-600 text-gray-100"
      />
      <KpiCard
        label="Success Rate"
        value={`${stats.successRate}%`}
        sub={`${stats.totalRuns - failed} successful`}
        accent="border-emerald-500 text-emerald-400"
      />
      <KpiCard
        label="SLA Compliance"
        value={`${stats.slaCompliance}%`}
        sub={`${slaIssues} SLA issue${slaIssues !== 1 ? "s" : ""}`}
        accent="border-blue-500 text-blue-400"
      />
      <KpiCard
        label="Avg Duration"
        value={
          stats.avgDurationSec >= 60
            ? `${(stats.avgDurationSec / 60).toFixed(1)}m`
            : `${stats.avgDurationSec}s`
        }
        sub="per run"
        accent="border-indigo-500 text-indigo-400"
      />
    </div>
  );
}
