"use client";

import { useState, useRef } from "react";
import { Plus, X, Trash2, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ProcessMatrix, MatrixCell, CellStatus, ProcessDefinition } from "@/types/rpa";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<CellStatus, { bg: string; border: string; text: string; label: string; symbol: string }> = {
  None:      { bg: "bg-gray-800",   border: "border-gray-700",   text: "text-gray-700",    label: "No run",     symbol: "—"  },
  Success:   { bg: "bg-emerald-900",border: "border-emerald-600",text: "text-emerald-300", label: "Success",    symbol: "✓"  },
  LateStart: { bg: "bg-yellow-900", border: "border-yellow-600", text: "text-yellow-300",  label: "Late Start", symbol: "⏰" },
  SLABreach: { bg: "bg-orange-900", border: "border-orange-600", text: "text-orange-300",  label: "SLA Breach", symbol: "⚡" },
  Failed:    { bg: "bg-red-900",    border: "border-red-600",    text: "text-red-300",     label: "Failed",     symbol: "✗"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

// ── Rich Tooltip ──────────────────────────────────────────────────────────────
interface TooltipState {
  cell: MatrixCell;
  processName: string;
  processDef?: ProcessDefinition;
  x: number;
  y: number;
  todayExpected: boolean;
}

function CellTooltip({ tt }: { tt: TooltipState }) {
  const { cell, processName, processDef, todayExpected } = tt;
  const cfg = STATUS_CFG[cell.status];

  // Position: above the cell, centred horizontally; clamp to viewport edges
  const left = Math.min(Math.max(tt.x, 104), window.innerWidth - 104);
  const top = tt.y - 8;

  return (
    <div
      style={{ position: "fixed", left, top, transform: "translate(-50%,-100%)", zIndex: 200 }}
      className="pointer-events-none w-52 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-3 text-xs"
    >
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-200 truncate max-w-[140px]">{processName}</span>
        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>

      {cell.status === "None" ? (
        <div className="text-gray-500 space-y-1">
          <p>No run recorded</p>
          {todayExpected && processDef?.expectedStartTime && (
            <p className="text-indigo-400">Expected at {processDef.expectedStartTime}</p>
          )}
        </div>
      ) : (
        <div className="space-y-1 text-gray-400">
          {cell.startTime && (
            <div className="flex justify-between">
              <span>Start</span>
              <span className="text-gray-200 font-mono">{fmtTime(cell.startTime)}</span>
            </div>
          )}
          {cell.durationSec !== undefined && (
            <div className="flex justify-between">
              <span>Duration</span>
              <span className={`font-mono ${cell.status === "SLABreach" ? "text-orange-300" : "text-gray-200"}`}>
                {fmtDuration(cell.durationSec)}
                {processDef && cell.status === "SLABreach" && (
                  <span className="text-gray-500 ml-1">/ {fmtDuration(processDef.slaMaxDuration)}</span>
                )}
              </span>
            </div>
          )}
          {(cell.volumeCount ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Volume</span>
              <span className="text-gray-200">{cell.volumeCount?.toLocaleString()}</span>
            </div>
          )}
          {cell.runCount > 1 && (
            <div className="flex justify-between">
              <span>Runs today</span>
              <span className="text-gray-200">{cell.runCount}</span>
            </div>
          )}
          {cell.errorMessage && (
            <p className="mt-1 text-red-400 truncate" title={cell.errorMessage}>
              {cell.errorMessage}
            </p>
          )}
        </div>
      )}
      {/* caret */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-700" />
    </div>
  );
}

// ── Cell Badge ────────────────────────────────────────────────────────────────
interface CellBadgeProps {
  cell: MatrixCell;
  processName: string;
  processDef?: ProcessDefinition;
  isToday: boolean;
  onErrorClick: () => void;
  onTooltipEnter: (e: React.MouseEvent) => void;
  onTooltipLeave: () => void;
}

function CellBadge({ cell, processDef, isToday, onErrorClick, onTooltipEnter, onTooltipLeave }: CellBadgeProps) {
  // Today expected but no run → dotted circle
  if (cell.status === "None" && isToday && processDef?.expectedStartTime) {
    return (
      <div
        onMouseEnter={onTooltipEnter}
        onMouseLeave={onTooltipLeave}
        className="w-8 h-8 rounded-full border-2 border-dashed border-indigo-600/50 flex items-center justify-center cursor-default"
        title={`Expected at ${processDef.expectedStartTime}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/40" />
      </div>
    );
  }

  // No run, not today
  if (cell.status === "None") {
    return (
      <div
        onMouseEnter={onTooltipEnter}
        onMouseLeave={onTooltipLeave}
        className="w-8 h-8 rounded-md bg-gray-800/60 border border-gray-700/50 flex items-center justify-center"
      >
        <span className="text-[10px] text-gray-700">—</span>
      </div>
    );
  }

  const cfg = STATUS_CFG[cell.status];
  const isClickable = cell.status === "Failed";

  return (
    <div className="relative inline-flex" onMouseEnter={onTooltipEnter} onMouseLeave={onTooltipLeave}>
      <button
        onClick={isClickable ? onErrorClick : undefined}
        className={`w-8 h-8 rounded-md border text-xs font-bold flex items-center justify-center transition-transform hover:scale-110
          ${cfg.bg} ${cfg.border} ${cfg.text}
          ${isClickable ? "cursor-pointer animate-pulse hover:animate-none" : "cursor-default"}`}
      >
        {cfg.symbol}
      </button>
      {cell.runCount > 1 && (
        <span className="absolute -top-1.5 -right-1.5 bg-gray-700 text-gray-200 text-[9px] font-bold rounded-full px-1 py-0.5 border border-gray-600 leading-none z-10">
          {cell.runCount}x
        </span>
      )}
    </div>
  );
}

// ── Error Detail Modal ────────────────────────────────────────────────────────
interface ErrorInfo { transactionId: string; processName: string; dayLabel: string; errorMessage: string; screenshotPath: string | null }

function ErrorModal({ info, onClose }: { info: ErrorInfo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-red-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Error Detail</p>
            <h2 className="mt-1 text-lg font-bold text-white">{info.processName}</h2>
            <p className="text-sm text-gray-400">{info.dayLabel} · TX: {info.transactionId}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none mt-1">×</button>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Error Message</p>
          <p className="text-sm text-red-300 whitespace-pre-wrap break-words">{info.errorMessage}</p>
        </div>
        {info.screenshotPath ? (
          <a href={info.screenshotPath} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2 break-all">
            {info.screenshotPath}
          </a>
        ) : (
          <p className="text-sm text-gray-600 italic">No screenshot attached</p>
        )}
        <button onClick={onClose} className="mt-5 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-2 rounded-lg text-sm font-medium transition-colors">Close</button>
      </div>
    </div>
  );
}

// ── Side Sheet ────────────────────────────────────────────────────────────────
interface SideSheetProps {
  processName: string;
  processDef: ProcessDefinition | null; // null = unregistered
  onClose: () => void;
  onRefresh: () => void;
}

function SideSheet({ processName, processDef, onClose, onRefresh }: SideSheetProps) {
  const [owner, setOwner]                     = useState(processDef?.owner ?? "");
  const [expectedStartTime, setExpectedStart] = useState(processDef?.expectedStartTime ?? "08:00");
  const [slaMaxDuration, setSlaMax]           = useState(String(processDef?.slaMaxDuration ?? 3600));
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      let res: Response;
      if (processDef) {
        res = await fetch(`/api/processes/${processDef.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, expectedStartTime, slaMaxDuration: parseInt(slaMaxDuration) || 3600 }),
        });
      } else {
        res = await fetch("/api/processes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processName, owner, expectedStartTime, slaMaxDuration: parseInt(slaMaxDuration) || 3600 }),
        });
      }
      if (!res.ok) { setError((await res.json()).error ?? "Failed to save"); return; }
      onRefresh();
      onClose();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  async function doDelete() {
    if (!processDef) return;
    setDeleting(true);
    try {
      await fetch(`/api/processes/${processDef.id}`, { method: "DELETE" });
      onRefresh();
      onClose();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-80 bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
              {processDef ? "Edit SLA Settings" : "Register Process"}
            </p>
            <h3 className="text-base font-bold text-white leading-snug break-all">{processName}</h3>
            {!processDef && (
              <p className="text-xs text-yellow-500 mt-1">Not yet registered — fill below to register.</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 shrink-0 -mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Owner</label>
            <input className={inputCls} placeholder="e.g. Operations Team" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Expected Start (HH:MM)</label>
            <input className={inputCls} type="time" value={expectedStartTime} onChange={(e) => setExpectedStart(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">SLA Max Duration (seconds)</label>
            <input className={inputCls} type="number" min={1} value={slaMaxDuration} onChange={(e) => setSlaMax(e.target.value)} />
            {slaMaxDuration && (
              <p className="text-xs text-gray-600 mt-1">= {fmtDuration(parseInt(slaMaxDuration) || 0)}</p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 space-y-2">
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? "Saving…" : processDef ? "Save Changes" : "Register Bot"}
          </button>

          {processDef && !confirmDel && (
            <button
              onClick={() => setConfirmDel(true)}
              className="w-full py-2 rounded-lg border border-red-900/60 text-red-500 hover:bg-red-900/20 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={13} /> Delete Process &amp; All Logs
            </button>
          )}

          {processDef && confirmDel && (
            <div className="rounded-lg border border-red-800/60 bg-red-900/15 p-3 space-y-2">
              <p className="text-xs text-red-300">This permanently deletes all run history. Are you sure?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)} className="flex-1 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors">Cancel</button>
                <button onClick={doDelete} disabled={deleting} className="flex-1 py-1.5 rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Add Bot Dialog ────────────────────────────────────────────────────────────
interface AddBotDialogProps { open: boolean; onClose: () => void; onRefresh: () => void }

function AddBotDialog({ open, onClose, onRefresh }: AddBotDialogProps) {
  const [processName, setProcessName]         = useState("");
  const [owner, setOwner]                     = useState("");
  const [expectedStartTime, setExpectedStart] = useState("08:00");
  const [slaMaxDuration, setSlaMax]           = useState("3600");
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  function reset() { setProcessName(""); setOwner(""); setExpectedStart("08:00"); setSlaMax("3600"); setError(null); }

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName: processName.trim(), owner, expectedStartTime, slaMaxDuration: parseInt(slaMaxDuration) || 3600 }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
      reset(); onRefresh(); onClose();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register New Bot</DialogTitle>
          <DialogDescription>Add an RPA process and configure its SLA thresholds.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Process Name</label>
            <input className={inputCls} placeholder="e.g. Pandora Report" value={processName} onChange={(e) => setProcessName(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Owner</label>
            <input className={inputCls} placeholder="e.g. Operations Team" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Expected Start (HH:MM)</label>
            <input className={inputCls} type="time" value={expectedStartTime} onChange={(e) => setExpectedStart(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">SLA Max Duration (seconds)</label>
            <input className={inputCls} type="number" min={1} value={slaMaxDuration} onChange={(e) => setSlaMax(e.target.value)} />
            {slaMaxDuration && (
              <p className="text-xs text-gray-600 mt-1">= {fmtDuration(parseInt(slaMaxDuration) || 0)}</p>
            )}
          </div>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors">Cancel</button>
          </DialogClose>
          <button onClick={save} disabled={saving || !processName.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {saving ? "Saving…" : "Register Bot"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  matrix: ProcessMatrix[];
  totalDays: number;
  startDate: string;
  processes: ProcessDefinition[];
  onRefresh: () => void;
}

export default function MatrixGrid({ matrix, totalDays, startDate, processes, onRefresh }: Props) {
  const [tooltip, setTooltip]         = useState<TooltipState | null>(null);
  const [errorInfo, setErrorInfo]     = useState<ErrorInfo | null>(null);
  const [sideSheet, setSideSheet]     = useState<{ processName: string } | null>(null);
  const [showAdd, setShowAdd]         = useState(false);

  const processDefMap = new Map(processes.map((p) => [p.processName, p]));

  // Compute today's dayIndex within the range
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIndex = Math.floor((today.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
  const todayInRange = todayIndex >= 1 && todayIndex <= totalDays;

  // Success % per process
  function successPct(row: ProcessMatrix): string {
    const active = row.cells.filter((c) => c.status !== "None");
    if (active.length === 0) return "—";
    const ok = active.filter((c) => c.status === "Success").length;
    return `${Math.round((ok / active.length) * 100)}%`;
  }

  // Tooltip handlers
  function handleCellEnter(e: React.MouseEvent, cell: MatrixCell, processName: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isToday = cell.dayIndex === todayIndex && todayInRange;
    setTooltip({
      cell,
      processName,
      processDef: processDefMap.get(processName),
      x: rect.left + rect.width / 2,
      y: rect.top,
      todayExpected: isToday,
    });
  }

  const sideSheetProcessDef = sideSheet ? processDefMap.get(sideSheet.processName) ?? null : null;

  // All registered processes that aren't yet in the matrix (for any future needs)
  // Include all processes from matrix + any registered-only processes not in matrix
  const matrixProcessNames = new Set(matrix.map((r) => r.processName));
  const registeredOnlyProcesses = processes.filter((p) => !matrixProcessNames.has(p.processName));

  // Merge matrix rows + registered-only (show as empty rows)
  const allRows: { processName: string; cells: MatrixCell[]; isRegisteredOnly: boolean }[] = [
    ...matrix.map((r) => ({ ...r, isRegisteredOnly: false })),
    ...registeredOnlyProcesses.map((p) => ({
      processName: p.processName,
      isRegisteredOnly: true,
      cells: Array.from({ length: totalDays }, (_, i) => ({
        dayIndex: i + 1,
        dateLabel: String(i + 1),
        status: "None" as CellStatus,
        runCount: 0,
      })),
    })),
  ];

  if (allRows.length === 0 && processes.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-8 text-center text-gray-500">
          No bots registered yet.{" "}
          <button onClick={() => setShowAdd(true)} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            Add the first one
          </button>
        </div>
        <AddBotDialog open={showAdd} onClose={() => setShowAdd(false)} onRefresh={onRefresh} />
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="min-w-max w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-800">
              {/* Process column header with '+' button */}
              <th className="text-left px-4 py-3 sticky left-0 bg-gray-900 z-20 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Process</span>
                  <button
                    onClick={() => setShowAdd(true)}
                    title="Register new bot"
                    className="p-0.5 rounded-md text-gray-600 hover:text-indigo-400 hover:bg-indigo-900/30 transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </th>

              {/* Success % column */}
              <th className="px-3 py-3 text-center sticky left-[180px] bg-gray-900 z-20 min-w-[52px]">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">%</span>
              </th>

              {/* Day columns — use first row's cells for labels */}
              {(allRows[0]?.cells ?? []).map((c) => (
                <th
                  key={c.dayIndex}
                  className={`px-0.5 py-3 text-center font-normal w-9 text-[11px] ${
                    c.dayIndex === todayIndex && todayInRange
                      ? "text-indigo-400 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  {c.dateLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, i) => {
              const pct = successPct({ processName: row.processName, cells: row.cells });
              const pctNum = pct === "—" ? null : parseInt(pct);
              const pctColor =
                pctNum === null ? "text-gray-600"
                : pctNum >= 90 ? "text-emerald-400"
                : pctNum >= 70 ? "text-yellow-400"
                : "text-red-400";

              return (
                <tr key={row.processName} className={i % 2 === 0 ? "" : "bg-gray-800/20"}>
                  {/* Clickable process name */}
                  <td className="px-4 py-2 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                    <button
                      onClick={() => setSideSheet({ processName: row.processName })}
                      className="flex items-center gap-1.5 group text-left"
                    >
                      <span className="text-gray-200 font-medium text-sm group-hover:text-indigo-300 transition-colors">
                        {row.processName}
                      </span>
                      <ChevronRight size={12} className="text-gray-700 group-hover:text-indigo-500 transition-colors shrink-0" />
                    </button>
                    {row.isRegisteredOnly && (
                      <span className="text-[10px] text-gray-600 -mt-0.5 block">No runs yet</span>
                    )}
                  </td>

                  {/* Success % */}
                  <td className={`px-3 py-2 text-center text-xs font-bold sticky left-[180px] bg-inherit z-10 ${pctColor}`}>
                    {pct}
                  </td>

                  {/* Day cells */}
                  {row.cells.map((cell) => {
                    const isToday = cell.dayIndex === todayIndex && todayInRange;
                    return (
                      <td key={cell.dayIndex} className={`px-0.5 py-2 text-center ${isToday ? "bg-indigo-950/20" : ""}`}>
                        <CellBadge
                          cell={cell}
                          processName={row.processName}
                          processDef={processDefMap.get(row.processName)}
                          isToday={isToday}
                          onErrorClick={() =>
                            setErrorInfo({
                              transactionId: cell.transactionId ?? "",
                              processName: row.processName,
                              dayLabel: cell.dateLabel,
                              errorMessage: cell.errorMessage ?? "No error message recorded.",
                              screenshotPath: cell.screenshotPath ?? null,
                            })
                          }
                          onTooltipEnter={(e) => handleCellEnter(e, cell, row.processName)}
                          onTooltipLeave={() => setTooltip(null)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-gray-800 text-[11px] text-gray-500">
          {(["Success", "LateStart", "SLABreach", "Failed"] as CellStatus[]).map((s) => {
            const cfg = STATUS_CFG[s];
            return (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${cfg.bg} border ${cfg.border} inline-block`} />
                {cfg.label}
              </span>
            );
          })}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-indigo-600/50 inline-block" />
            Expected today
          </span>
          <span className="ml-auto text-gray-600 flex items-center gap-1.5">
            Click process name to edit SLA
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <CellTooltip tt={tooltip} />}

      {/* Error Modal */}
      {errorInfo && <ErrorModal info={errorInfo} onClose={() => setErrorInfo(null)} />}

      {/* Side Sheet */}
      {sideSheet && (
        <SideSheet
          processName={sideSheet.processName}
          processDef={sideSheetProcessDef}
          onClose={() => setSideSheet(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* Add Bot Dialog */}
      <AddBotDialog open={showAdd} onClose={() => setShowAdd(false)} onRefresh={onRefresh} />
    </>
  );
}
