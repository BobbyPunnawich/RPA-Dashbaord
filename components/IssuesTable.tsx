"use client";

import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ProcessMatrix, ProcessDefinition, DashboardStats } from "@/types/rpa";

export interface IssueErrorInfo {
  transactionId: string;
  processName: string;
  errorMessage: string;
  screenshotPath: string | null;
}

interface Props {
  todayMatrix: ProcessMatrix[] | null;
  processes: ProcessDefinition[];
  stats: DashboardStats | null;
  onErrorClick: (info: IssueErrorInfo) => void;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function IssuesTable({ todayMatrix, processes, stats, onErrorClick }: Props) {
  const processDefMap = new Map(processes.map((p) => [p.processName, p]));

  const failedBots = (todayMatrix ?? [])
    .flatMap(({ processName, cells }) =>
      cells
        .filter((c) => c.status === "Failed")
        .map((cell) => ({ processName, cell, def: processDefMap.get(processName) }))
    );

  if (failedBots.length === 0) return null;

  const failedRunCount = stats?.breakdown?.failed ?? failedBots.length;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <AlertTriangle size={15} className="text-red-400 shrink-0" />
        <h2 className="text-base font-bold text-white">Failed Today</h2>
        <span className="text-[10px] text-white bg-red-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">
          {failedRunCount}
        </span>
        <span className="text-[10px] text-gray-500">
          {failedRunCount} run{failedRunCount !== 1 ? "s" : ""} · {failedBots.length} bot{failedBots.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-gray-900 rounded-xl border border-red-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[580px]">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] uppercase tracking-widest text-gray-500">
                <th className="text-left px-4 py-2.5 font-semibold">Bot</th>
                <th className="text-left px-4 py-2.5 font-semibold">Runs</th>
                <th className="text-left px-4 py-2.5 font-semibold">Time</th>
                <th className="text-left px-4 py-2.5 font-semibold">Duration</th>
                <th className="text-left px-4 py-2.5 font-semibold">Error</th>
                <th className="text-left px-4 py-2.5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {failedBots.map(({ processName, cell, def }) => {
                const slaPct =
                  def && cell.durationSec !== undefined
                    ? Math.round((cell.durationSec / def.slaMaxDuration) * 100)
                    : null;

                return (
                  <tr
                    key={processName}
                    className="border-l-2 border-l-red-600 hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Bot name */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-200 truncate max-w-[130px] block" title={processName}>
                        {processName}
                      </span>
                      {def?.owner && <span className="text-[10px] text-gray-500">{def.owner}</span>}
                    </td>

                    {/* Run count */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5">
                        {cell.runCount}×
                      </span>
                    </td>

                    {/* Start time */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                        <Clock size={11} className="shrink-0 text-gray-600" />
                        {cell.startTime ? fmtTime(cell.startTime) : "—"}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-300">
                        {cell.durationSec !== undefined ? fmtDuration(cell.durationSec) : "—"}
                      </span>
                      {slaPct !== null && slaPct > 100 && (
                        <span className="block text-[10px] text-orange-400">{slaPct}% of SLA</span>
                      )}
                    </td>

                    {/* Error message */}
                    <td className="px-4 py-3 max-w-[260px]">
                      {cell.errorMessage ? (
                        <button
                          onClick={() => onErrorClick({
                            transactionId: cell.transactionId ?? "",
                            processName,
                            errorMessage: cell.errorMessage!,
                            screenshotPath: cell.screenshotPath ?? null,
                          })}
                          className="text-xs text-red-400 hover:text-red-300 text-left transition-colors truncate block max-w-[260px]"
                          title={cell.errorMessage}
                        >
                          {cell.errorMessage.length > 80
                            ? cell.errorMessage.slice(0, 80) + "…"
                            : cell.errorMessage}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>

                    {/* View link */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/process/${encodeURIComponent(processName)}`}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-900 hover:border-indigo-600 rounded-md px-2 py-1 transition-colors"
                      >
                        View <ExternalLink size={10} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
