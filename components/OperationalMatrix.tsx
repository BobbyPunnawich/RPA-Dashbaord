"use client";

import { useState } from "react";
import ErrorModal from "./ErrorModal";
import { ProcessMatrix, MatrixCell } from "@/types/rpa";

interface Props {
  matrix: ProcessMatrix[];
  daysInMonth: number;
  month: number;
  year: number;
}

interface SelectedError {
  transactionId: string;
  processName: string;
  day: number;
  errorMessage: string;
  screenshotPath: string | null;
}

function CellBadge({ cell, processName, onClick }: { cell: MatrixCell; processName: string; onClick: () => void }) {
  if (cell.status === "None") {
    return (
      <div className="w-9 h-9 rounded-md bg-gray-800 border border-gray-700 flex items-center justify-center">
        <span className="text-xs text-gray-700">&mdash;</span>
      </div>
    );
  }

  const isSuccess = cell.status === "Success";
  return (
    <button
      onClick={isSuccess ? undefined : onClick}
      title={
        isSuccess
          ? `${processName} | Day ${cell.day} | ${cell.durationSec}s`
          : `${processName} | Day ${cell.day} | FAILED`
      }
      className={`w-9 h-9 rounded-md border text-xs font-bold flex items-center justify-center transition-transform hover:scale-110 ${
        isSuccess
          ? "bg-emerald-900 border-emerald-600 text-emerald-300 cursor-default"
          : "bg-red-900 border-red-600 text-red-300 cursor-pointer animate-pulse hover:animate-none"
      }`}
    >
      {isSuccess ? "✓" : "✗"}
    </button>
  );
}

export default function OperationalMatrix({ matrix, daysInMonth, month, year }: Props) {
  const [selectedError, setSelectedError] = useState<SelectedError | null>(null);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthLabel = new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Operational Matrix</h2>
        <span className="text-sm text-gray-400">{monthLabel}</span>
      </div>

      {matrix.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
          No bot runs recorded for this period.
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="min-w-max w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 font-semibold sticky left-0 bg-gray-900 min-w-[160px]">
                  Process
                </th>
                {days.map((d) => (
                  <th key={d} className="px-1 py-3 text-center text-gray-500 font-normal w-10">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={row.processName} className={i % 2 === 0 ? "" : "bg-gray-800/30"}>
                  <td className="px-4 py-2 text-gray-200 font-medium sticky left-0 bg-inherit whitespace-nowrap">
                    {row.processName}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.day} className="px-1 py-2 text-center">
                      <CellBadge
                        cell={cell}
                        processName={row.processName}
                        onClick={() =>
                          setSelectedError({
                            transactionId: cell.transactionId!,
                            processName: row.processName,
                            day: cell.day,
                            errorMessage: cell.errorMessage ?? "No error message recorded.",
                            screenshotPath: cell.screenshotPath ?? null,
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-6 px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-900 border border-emerald-600 inline-block" />
              Success
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-900 border border-red-600 inline-block" />
              Failed (click for details)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-800 border border-gray-700 inline-block" />
              No run
            </span>
          </div>
        </div>
      )}

      {selectedError && (
        <ErrorModal
          {...selectedError}
          onClose={() => setSelectedError(null)}
        />
      )}
    </section>
  );
}
