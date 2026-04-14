"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: "green" | "blue" | "purple" | "default";
}

const colorMap = {
  green: "border-emerald-500 text-emerald-400",
  blue: "border-blue-500 text-blue-400",
  purple: "border-indigo-500 text-indigo-400",
  default: "border-gray-700 text-gray-100",
};

export default function StatCard({ label, value, sub, color = "default" }: StatCardProps) {
  return (
    <div className={`bg-gray-900 rounded-xl border-l-4 ${colorMap[color]} px-6 py-5 shadow`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${colorMap[color].split(" ")[1]}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
    </div>
  );
}
