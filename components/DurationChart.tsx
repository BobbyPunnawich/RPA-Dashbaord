"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { ChartDataPoint } from "@/types/rpa";

interface Props {
  processName: string;
  from: string;
  to: string;
  slaMaxDuration: number;
}

export default function DurationChart({ processName, from, to, slaMaxDuration }: Props) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ processName, from, to });
    fetch(`/api/logs/chart?${params}`)
      .then((r) => r.json())
      .then((json) => setData(json.data ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [processName, from, to]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
        Loading chart…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-600 text-sm italic">
        No run data available for the selected period.
      </div>
    );
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#4b5563" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#4b5563" }}
            tickLine={false}
            tickFormatter={(v) => (v >= 60 ? `${Math.round(v / 60)}m` : `${v}s`)}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: 12,
              color: "#e5e7eb",
            }}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value) || 0;
              const formatted =
                num >= 60 ? `${(num / 60).toFixed(1)} min` : `${num}s`;
              return [formatted, name === "avgDuration" ? "Avg Duration" : "SLA Limit"];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
            formatter={(value) =>
              value === "avgDuration" ? "Avg Duration" : "SLA Limit"
            }
          />
          <ReferenceLine
            y={slaMaxDuration}
            stroke="#f97316"
            strokeDasharray="6 3"
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="avgDuration"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: "#6366f1" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
