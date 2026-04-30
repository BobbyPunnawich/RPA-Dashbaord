"use client";

import { useMemo } from "react";

interface RunRecord {
  errorCode: string | null;
  errorDetail: {
    errorMessage: string;
    errorCode: string | null;
  } | null;
}

interface Props {
  runs: RunRecord[];
}

const BUBBLE_PALETTE = [
  "bg-red-950/80   border-red-800    text-red-200",
  "bg-rose-950/80  border-rose-800   text-rose-200",
  "bg-orange-950/80 border-orange-800 text-orange-200",
  "bg-red-900/70   border-red-700    text-red-300",
];

export default function ErrorBubbleChart({ runs }: Props) {
  const bubbles = useMemo(() => {
    const map = new Map<string, { message: string; code: string | null; count: number }>();
    for (const run of runs) {
      const msg = run.errorDetail?.errorMessage;
      if (!msg) continue;
      const existing = map.get(msg);
      if (existing) {
        existing.count++;
      } else {
        map.set(msg, {
          message: msg,
          code: run.errorCode ?? run.errorDetail?.errorCode ?? null,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [runs]);

  if (bubbles.length === 0) return null;

  const maxCount = bubbles[0].count;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
        Error Frequency — bubble size = occurrences
      </p>
      <div className="flex flex-wrap gap-4 items-end">
        {bubbles.map(({ message, code, count }, idx) => {
          const ratio      = count / maxCount;
          const size       = Math.round(52 + ratio * 64);
          const colorCls   = BUBBLE_PALETTE[idx % BUBBLE_PALETTE.length];
          const shortLabel = code ?? message.replace(/^[\w.]+:\s*/, "").slice(0, 20);
          return (
            <div
              key={message}
              title={`${message}\n(${count} occurrence${count !== 1 ? "s" : ""})`}
              className={`flex flex-col items-center justify-center rounded-full border shrink-0
                          cursor-default select-none transition-transform hover:scale-110 ${colorCls}`}
              style={{ width: size, height: size }}
            >
              <span className="text-[13px] font-bold leading-none">{count}×</span>
              {size >= 70 && (
                <span
                  className="text-[7px] mt-0.5 opacity-60 text-center leading-tight px-1 line-clamp-2"
                  style={{ maxWidth: size - 12 }}
                >
                  {shortLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-4 space-y-1">
        {bubbles.map(({ message, count }) => (
          <div key={message} className="flex items-start gap-2 text-[11px]">
            <span className="text-red-400 font-bold shrink-0 w-6 text-right">{count}×</span>
            <span className="text-gray-400 leading-snug">{message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
