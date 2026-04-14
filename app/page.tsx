import StatCard from "@/components/StatCard";
import OperationalMatrix from "@/components/OperationalMatrix";

async function getDashboardData(month: number, year: number) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/logs?month=${month}&year=${year}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = parseInt(params.month ?? String(now.getMonth() + 1));
  const year = parseInt(params.year ?? String(now.getFullYear()));

  const data = await getDashboardData(month, year);

  const stats = data?.stats ?? { successRate: 0, avgDurationSec: 0, totalVolume: 0, totalRuns: 0 };
  const matrix = data?.matrix ?? [];
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthLabel = new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  // Month navigation helpers
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <div className="space-y-8">
      {/* Month Navigation */}
      <div className="flex items-center gap-4">
        <a
          href={`/?month=${prevMonth}&year=${prevYear}`}
          className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          &larr; {new Date(prevYear, prevMonth - 1).toLocaleString("en-US", { month: "short" })}
        </a>
        <h1 className="text-xl font-bold text-white">{monthLabel}</h1>
        {!isCurrentMonth && (
          <a
            href={`/?month=${nextMonth}&year=${nextYear}`}
            className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            {new Date(nextYear, nextMonth - 1).toLocaleString("en-US", { month: "short" })} &rarr;
          </a>
        )}
      </div>

      {/* ── Executive View ── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4">Executive View</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Success Rate"
            value={`${stats.successRate}%`}
            sub={`${stats.totalRuns} total runs`}
            color="green"
          />
          <StatCard
            label="Avg Bot Speed"
            value={`${stats.avgDurationSec}s`}
            sub="Average duration per run"
            color="blue"
          />
          <StatCard
            label="Total Volume"
            value={stats.totalVolume.toLocaleString()}
            sub="Items processed"
            color="purple"
          />
          <StatCard
            label="Total Runs"
            value={stats.totalRuns}
            sub={`${stats.totalRuns - Math.round((stats.successRate / 100) * stats.totalRuns)} failed`}
            color="default"
          />
        </div>
      </section>

      {/* ── Operational Matrix ── */}
      <OperationalMatrix
        matrix={matrix}
        daysInMonth={daysInMonth}
        month={month}
        year={year}
      />

      {/* DB not connected notice */}
      {!data && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl px-6 py-4 text-sm text-yellow-300">
          <strong>Database not connected.</strong> Set <code>DATABASE_URL</code> in <code>.env.local</code> and run{" "}
          <code>npm run db:push</code> to create the schema.
        </div>
      )}
    </div>
  );
}
