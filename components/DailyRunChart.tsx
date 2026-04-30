"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface RunRecord {
  status: string;
  startTime: string;
}

interface Props {
  runs: RunRecord[];
}

export default function DailyRunChart({ runs }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, { date: string; Success: number; Failed: number }>();
    for (const run of runs) {
      const d   = new Date(run.startTime);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      if (!map.has(key)) {
        const label = d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
        map.set(key, { date: label, Success: 0, Failed: 0 });
      }
      const entry = map.get(key)!;
      if (run.status === "Failed") entry.Failed++;
      else entry.Success++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [runs]);

  if (data.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
        Daily Run Breakdown
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="30%" barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: "#e5e7eb" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "#9ca3af", paddingTop: 8 }}
          />
          <Bar dataKey="Success" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Failed"  fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
