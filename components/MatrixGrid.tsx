"use client";

import { useState } from "react";
import { Plus, X, Trash2, ChevronRight, Clock, Zap } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { ProcessMatrix, MatrixCell, CellStatus, ProcessDefinition, BotType } from "@/types/rpa";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<CellStatus, { bg: string; border: string; text: string; label: string; symbol: string }> = {
  None:      { bg: "bg-gray-800",    border: "border-gray-700",    text: "text-gray-700",    label: "No run",     symbol: "—"  },
  Success:   { bg: "bg-emerald-900", border: "border-emerald-600", text: "text-emerald-300", label: "Success",    symbol: "✓"  },
  LateStart: { bg: "bg-yellow-900",  border: "border-yellow-600",  text: "text-yellow-300",  label: "Late Start", symbol: "⏰" },
  SLABreach: { bg: "bg-orange-900",  border: "border-orange-600",  text: "text-orange-300",  label: "SLA Breach", symbol: "⚡" },
  Failed:    { bg: "bg-red-900",     border: "border-red-600",     text: "text-red-300",     label: "Failed",     symbol: "✗"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function successPct(cells: MatrixCell[]): string {
  const active = cells.filter((c) => c.status !== "None");
  if (!active.length) return "—";
  return `${Math.round((active.filter((c) => c.status === "Success").length / active.length) * 100)}%`;
}
function latestStatus(cells: MatrixCell[]): CellStatus {
  return [...cells].reverse().find((c) => c.status !== "None")?.status ?? "None";
}

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

// ── Bot type toggle ───────────────────────────────────────────────────────────
function BotTypeToggle({ value, onChange }: { value: BotType; onChange: (v: BotType) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs font-semibold">
      {(["Scheduled", "OnDemand"] as BotType[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${
            value === t ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          {t === "Scheduled" ? <Clock size={11} /> : <Zap size={11} />}
          {t === "Scheduled" ? "Scheduled" : "On-Demand"}
        </button>
      ))}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
interface TooltipState {
  cell: MatrixCell; processName: string; processDef?: ProcessDefinition;
  x: number; y: number; todayExpected: boolean;
}
function CellTooltip({ tt }: { tt: TooltipState }) {
  const { cell, processName, processDef, todayExpected } = tt;
  const cfg = STATUS_CFG[cell.status];
  const left = Math.min(Math.max(tt.x, 104), window.innerWidth - 104);
  return (
    <div style={{ position: "fixed", left, top: tt.y - 8, transform: "translate(-50%,-100%)", zIndex: 200 }}
      className="pointer-events-none w-52 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-3 text-xs"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-200 truncate max-w-[140px]">{processName}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{cfg.label}</span>
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
          {cell.startTime && <div className="flex justify-between"><span>Start</span><span className="text-gray-200 font-mono">{fmtTime(cell.startTime)}</span></div>}
          {cell.durationSec !== undefined && (
            <div className="flex justify-between">
              <span>Duration</span>
              <span className={`font-mono ${cell.status === "SLABreach" ? "text-orange-300" : "text-gray-200"}`}>
                {fmtDuration(cell.durationSec)}
                {processDef && cell.status === "SLABreach" && <span className="text-gray-500 ml-1">/ {fmtDuration(processDef.slaMaxDuration)}</span>}
              </span>
            </div>
          )}
          {(cell.volumeCount ?? 0) > 0 && <div className="flex justify-between"><span>Volume</span><span className="text-gray-200">{cell.volumeCount?.toLocaleString()}</span></div>}
          {cell.runCount > 1 && <div className="flex justify-between"><span>Runs today</span><span className="text-gray-200">{cell.runCount}</span></div>}
          {cell.errorMessage && <p className="mt-1 text-red-400 truncate">{cell.errorMessage}</p>}
        </div>
      )}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-700" />
    </div>
  );
}

// ── Cell Badge ────────────────────────────────────────────────────────────────
interface CellBadgeProps {
  cell: MatrixCell; processDef?: ProcessDefinition; isToday: boolean;
  onErrorClick: () => void;
  onTipEnter: (e: React.MouseEvent) => void;
  onTipLeave: () => void;
}
function CellBadge({ cell, processDef, isToday, onErrorClick, onTipEnter, onTipLeave }: CellBadgeProps) {
  if (cell.status === "None" && isToday && processDef?.botType === "Scheduled" && processDef?.expectedStartTime) {
    return (
      <div onMouseEnter={onTipEnter} onMouseLeave={onTipLeave}
        className="w-8 h-8 rounded-full border-2 border-dashed border-indigo-600/50 flex items-center justify-center cursor-default">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/40" />
      </div>
    );
  }
  if (cell.status === "None") {
    return (
      <div onMouseEnter={onTipEnter} onMouseLeave={onTipLeave}
        className="w-8 h-8 rounded-md bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
        <span className="text-[10px] text-gray-700">—</span>
      </div>
    );
  }
  const cfg = STATUS_CFG[cell.status];
  return (
    <div className="relative inline-flex" onMouseEnter={onTipEnter} onMouseLeave={onTipLeave}>
      <button onClick={cell.status === "Failed" ? onErrorClick : undefined}
        className={`w-8 h-8 rounded-md border text-xs font-bold flex items-center justify-center transition-transform hover:scale-110
          ${cfg.bg} ${cfg.border} ${cfg.text}
          ${cell.status === "Failed" ? "cursor-pointer animate-pulse hover:animate-none" : "cursor-default"}`}>
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

// ── Error Modal ───────────────────────────────────────────────────────────────
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
        {info.screenshotPath
          ? <a href={info.screenshotPath} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2 break-all">{info.screenshotPath}</a>
          : <p className="text-sm text-gray-600 italic">No screenshot attached</p>}
        <button onClick={onClose} className="mt-5 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-2 rounded-lg text-sm font-medium transition-colors">Close</button>
      </div>
    </div>
  );
}

// ── Side Sheet ────────────────────────────────────────────────────────────────
interface SideSheetProps { processName: string; processDef: ProcessDefinition | null; onClose: () => void; onRefresh: () => void }
function SideSheet({ processName, processDef, onClose, onRefresh }: SideSheetProps) {
  const [botType, setBotType]                 = useState<BotType>((processDef?.botType as BotType) ?? "Scheduled");
  const [owner, setOwner]                     = useState(processDef?.owner ?? "");
  const [expectedStartTime, setExpectedStart] = useState(processDef?.expectedStartTime ?? "08:00");
  const [slaMaxDuration, setSlaMax]           = useState(String(processDef?.slaMaxDuration ?? 3600));
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const body = { owner, botType, expectedStartTime: botType === "Scheduled" ? expectedStartTime : "", slaMaxDuration: parseInt(slaMaxDuration) || 3600 };
      const res = processDef
        ? await fetch(`/api/processes/${processDef.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/processes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ processName, ...body }) });
      if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
      onRefresh(); onClose();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  async function doDelete() {
    if (!processDef) return;
    setDeleting(true);
    await fetch(`/api/processes/${processDef.id}`, { method: "DELETE" }).catch(() => {});
    onRefresh(); onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-80 bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
              {processDef ? "Edit Bot" : "Register Process"}
            </p>
            <h3 className="text-base font-bold text-white leading-snug break-all">{processName}</h3>
            {!processDef && <p className="text-xs text-yellow-500 mt-1">Not yet registered.</p>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Bot Type</label>
            <BotTypeToggle value={botType} onChange={setBotType} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Owner</label>
            <input className={inputCls} placeholder="e.g. Operations Team" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          {botType === "Scheduled" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Expected Start (HH:MM)</label>
              <input className={inputCls} type="time" value={expectedStartTime} onChange={(e) => setExpectedStart(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">SLA Max Duration (seconds)</label>
            <input className={inputCls} type="number" min={1} value={slaMaxDuration} onChange={(e) => setSlaMax(e.target.value)} />
            {slaMaxDuration && <p className="text-xs text-gray-600 mt-1">= {fmtDuration(parseInt(slaMaxDuration) || 0)}</p>}
          </div>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-800 space-y-2">
          <button onClick={save} disabled={saving}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {saving ? "Saving…" : processDef ? "Save Changes" : "Register Bot"}
          </button>
          {processDef && !confirmDel && (
            <button onClick={() => setConfirmDel(true)}
              className="w-full py-2 rounded-lg border border-red-900/60 text-red-500 hover:bg-red-900/20 text-sm font-medium transition-colors flex items-center justify-center gap-2">
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
function AddBotDialog({ open, onClose, onRefresh }: { open: boolean; onClose: () => void; onRefresh: () => void }) {
  const [processName, setProcessName] = useState("");
  const [botType, setBotType]         = useState<BotType>("Scheduled");
  const [owner, setOwner]             = useState("");
  const [expectedStartTime, setExpectedStart] = useState("08:00");
  const [slaMaxDuration, setSlaMax]   = useState("3600");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function reset() { setProcessName(""); setBotType("Scheduled"); setOwner(""); setExpectedStart("08:00"); setSlaMax("3600"); setError(null); }

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/processes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processName: processName.trim(), botType, owner, expectedStartTime: botType === "Scheduled" ? expectedStartTime : "", slaMaxDuration: parseInt(slaMaxDuration) || 3600 }),
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
          <DialogDescription>Add an RPA process and configure its type and SLA.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Process Name</label>
            <input className={inputCls} placeholder="e.g. Pandora Report" value={processName} onChange={(e) => setProcessName(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Bot Type</label>
            <BotTypeToggle value={botType} onChange={setBotType} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Owner</label>
            <input className={inputCls} placeholder="e.g. Operations Team" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          {botType === "Scheduled" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Expected Start (HH:MM)</label>
              <input className={inputCls} type="time" value={expectedStartTime} onChange={(e) => setExpectedStart(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">SLA Max Duration (seconds)</label>
            <input className={inputCls} type="number" min={1} value={slaMaxDuration} onChange={(e) => setSlaMax(e.target.value)} />
            {slaMaxDuration && <p className="text-xs text-gray-600 mt-1">= {fmtDuration(parseInt(slaMaxDuration) || 0)}</p>}
          </div>
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors">Cancel</button>
          </DialogClose>
          <button onClick={save} disabled={saving || !processName.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            {saving ? "Saving…" : "Register Bot"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Bot Table (reusable for each section) ─────────────────────────────────────
interface RowData { processName: string; cells: MatrixCell[]; isRegisteredOnly: boolean }

interface BotTableProps {
  rows: RowData[];
  showStartCol: boolean;
  todayIndex: number;
  todayInRange: boolean;
  processDefMap: Map<string, ProcessDefinition>;
  onSideSheet: (name: string) => void;
  onError: (info: ErrorInfo) => void;
  onTipEnter: (e: React.MouseEvent, cell: MatrixCell, name: string) => void;
  onTipLeave: () => void;
}

function BotTable({ rows, showStartCol, todayIndex, todayInRange, processDefMap, onSideSheet, onError, onTipEnter, onTipLeave }: BotTableProps) {
  if (!rows.length) return null;

  // Sticky left offsets depend on whether Start column is shown
  const L = showStartCol
    ? { owner: 152, start: 260, sla: 328, status: 388, pct: 472 }
    : { owner: 152,             sla: 260, status: 320, pct: 404 };

  return (
    <div className="bg-gray-900 rounded-t-xl border border-gray-800 border-b-0 overflow-x-auto">
      <table className="min-w-max w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-800">
            {/* Process */}
            <th className="text-left px-4 py-2.5 sticky left-0 bg-gray-900 z-20 w-[152px] min-w-[152px]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Process</span>
            </th>
            {/* Owner */}
            <th style={{ left: L.owner }} className="px-3 py-2.5 text-left sticky bg-gray-900 z-20 w-[108px] min-w-[108px]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Owner</span>
            </th>
            {/* Start — Scheduled only */}
            {showStartCol && (
              <th style={{ left: L.start }} className="px-2 py-2.5 text-left sticky bg-gray-900 z-20 w-[68px] min-w-[68px]">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Start</span>
              </th>
            )}
            {/* SLA */}
            <th style={{ left: L.sla }} className="px-2 py-2.5 text-left sticky bg-gray-900 z-20 w-[60px] min-w-[60px]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">SLA</span>
            </th>
            {/* Status */}
            <th style={{ left: L.status }} className="px-2 py-2.5 text-left sticky bg-gray-900 z-20 w-[84px] min-w-[84px]">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Status</span>
            </th>
            {/* Success % + divider */}
            <th style={{ left: L.pct }} className="px-2 py-2.5 text-center sticky bg-gray-900 z-20 w-[48px] min-w-[48px] border-r border-gray-700/60">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">%</span>
            </th>
            {/* Day columns */}
            {rows[0].cells.map((c) => (
              <th key={c.dayIndex}
                className={`px-0.5 py-2.5 text-center font-normal w-9 text-[11px] ${c.dayIndex === todayIndex && todayInRange ? "text-indigo-400 font-semibold" : "text-gray-600"}`}>
                {c.dateLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const pct    = successPct(row.cells);
            const pctNum = pct === "—" ? null : parseInt(pct);
            const pctColor = pctNum === null ? "text-gray-600" : pctNum >= 90 ? "text-emerald-400" : pctNum >= 70 ? "text-yellow-400" : "text-red-400";
            const ls     = latestStatus(row.cells);
            const lsCfg  = STATUS_CFG[ls];
            const def    = processDefMap.get(row.processName);
            const rowBg  = i % 2 === 0 ? "" : "bg-gray-800/25";

            return (
              <tr key={row.processName}>
                {/* Process */}
                <td className="px-4 py-2.5 sticky left-0 z-10 w-[152px] min-w-[152px] bg-gray-900">
                  <button onClick={() => onSideSheet(row.processName)} className="flex items-center gap-1.5 group text-left w-full">
                    <span className="text-gray-200 font-medium text-sm group-hover:text-indigo-300 transition-colors truncate max-w-[122px]">{row.processName}</span>
                    <ChevronRight size={11} className="text-gray-700 group-hover:text-indigo-500 transition-colors shrink-0" />
                  </button>
                  {row.isRegisteredOnly && <span className="text-[10px] text-gray-600 block leading-tight mt-0.5">No runs yet</span>}
                </td>
                {/* Owner */}
                <td style={{ left: L.owner }} className="px-3 py-2.5 sticky z-10 w-[108px] min-w-[108px] bg-gray-900">
                  <span className="text-[11px] text-gray-300 truncate block max-w-[96px]">
                    {def?.owner || <span className="text-gray-600 italic">—</span>}
                  </span>
                </td>
                {/* Start */}
                {showStartCol && (
                  <td style={{ left: L.start }} className="px-2 py-2.5 sticky z-10 w-[68px] min-w-[68px] bg-gray-900">
                    <span className="text-[11px] font-mono text-gray-400">{def?.expectedStartTime || <span className="text-gray-700">—</span>}</span>
                  </td>
                )}
                {/* SLA */}
                <td style={{ left: L.sla }} className="px-2 py-2.5 sticky z-10 w-[60px] min-w-[60px] bg-gray-900">
                  <span className="text-[11px] text-gray-400">{def ? fmtDuration(def.slaMaxDuration) : <span className="text-gray-700">—</span>}</span>
                </td>
                {/* Status */}
                <td style={{ left: L.status }} className="px-2 py-2.5 sticky z-10 w-[84px] min-w-[84px] bg-gray-900">
                  {ls === "None"
                    ? <span className="text-[10px] text-gray-700">No runs</span>
                    : <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${lsCfg.bg} ${lsCfg.text} ${lsCfg.border}`}>{lsCfg.label}</span>}
                </td>
                {/* Success % */}
                <td style={{ left: L.pct }} className={`px-2 py-2.5 text-center text-xs font-bold sticky z-10 w-[48px] min-w-[48px] border-r border-gray-700/60 bg-gray-900 ${pctColor}`}>
                  {pct}
                </td>
                {/* Day cells */}
                {row.cells.map((cell) => {
                  const isToday = cell.dayIndex === todayIndex && todayInRange;
                  return (
                    <td key={cell.dayIndex} className={`px-0.5 py-2 text-center ${isToday ? "bg-indigo-950/30" : rowBg}`}>
                      <CellBadge
                        cell={cell} processDef={def} isToday={isToday}
                        onErrorClick={() => onError({ transactionId: cell.transactionId ?? "", processName: row.processName, dayLabel: cell.dateLabel, errorMessage: cell.errorMessage ?? "No error message recorded.", screenshotPath: cell.screenshotPath ?? null })}
                        onTipEnter={(e) => onTipEnter(e, cell, row.processName)}
                        onTipLeave={onTipLeave}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Legend (shared) ───────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gray-900 border border-gray-800 rounded-b-xl border-t-0 text-[11px] text-gray-500">
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
      <span className="ml-auto text-gray-600">Click process name to edit</span>
    </div>
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
  const [tooltip,    setTooltip]    = useState<TooltipState | null>(null);
  const [errorInfo,  setErrorInfo]  = useState<ErrorInfo | null>(null);
  const [sideSheet,  setSideSheet]  = useState<{ processName: string } | null>(null);
  const [showAdd,    setShowAdd]    = useState(false);

  const processDefMap = new Map(processes.map((p) => [p.processName, p]));

  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIndex   = Math.floor((today.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
  const todayInRange = todayIndex >= 1 && todayIndex <= totalDays;

  function handleTipEnter(e: React.MouseEvent, cell: MatrixCell, processName: string) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ cell, processName, processDef: processDefMap.get(processName), x: rect.left + rect.width / 2, y: rect.top, todayExpected: cell.dayIndex === todayIndex && todayInRange });
  }

  // Build allRows: matrix rows + registered-only rows
  const matrixNames = new Set(matrix.map((r) => r.processName));
  const emptyRow = (p: ProcessDefinition): RowData => ({
    processName: p.processName,
    isRegisteredOnly: true,
    cells: Array.from({ length: totalDays }, (_, i) => ({
      dayIndex: i + 1, dateLabel: String(i + 1), status: "None" as CellStatus, runCount: 0,
    })),
  });

  const allRows: RowData[] = [
    ...matrix.map((r) => ({ ...r, isRegisteredOnly: false })),
    ...processes.filter((p) => !matrixNames.has(p.processName)).map(emptyRow),
  ];

  // Split by botType — unregistered processes default to Scheduled
  const scheduledRows = allRows.filter((r) => {
    const def = processDefMap.get(r.processName);
    return !def || def.botType === "Scheduled";
  });
  const onDemandRows = allRows.filter((r) => {
    const def = processDefMap.get(r.processName);
    return def?.botType === "OnDemand";
  });

  const isEmpty = scheduledRows.length === 0 && onDemandRows.length === 0;

  const tableProps = {
    todayIndex, todayInRange, processDefMap,
    onSideSheet: (name: string) => setSideSheet({ processName: name }),
    onError: setErrorInfo,
    onTipEnter: handleTipEnter,
    onTipLeave: () => setTooltip(null),
  };

  if (isEmpty) {
    return (
      <>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500 text-sm">
          No bots registered yet.{" "}
          <button onClick={() => setShowAdd(true)} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Add the first one</button>
        </div>
        <AddBotDialog open={showAdd} onClose={() => setShowAdd(false)} onRefresh={onRefresh} />
      </>
    );
  }

  return (
    <>
      {/* ── Section header + add button ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-600">Click a process name to edit · Dates scroll right</span>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors">
          <Plus size={12} /> Add Bot
        </button>
      </div>

      {/* ── Scheduled Bots ───────────────────────────────────────────────────── */}
      {scheduledRows.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <Clock size={13} className="text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">Scheduled Bots</span>
            <span className="text-xs text-gray-600">{scheduledRows.length} bot{scheduledRows.length !== 1 ? "s" : ""}</span>
          </div>
          <BotTable rows={scheduledRows} showStartCol={true} {...tableProps} />
          {onDemandRows.length === 0 && <Legend />}
        </div>
      )}

      {/* ── On-Demand Bots ───────────────────────────────────────────────────── */}
      {onDemandRows.length > 0 && (
        <div className={scheduledRows.length > 0 ? "mt-5" : ""}>
          <div className="flex items-center gap-2 px-1 mb-1.5">
            <Zap size={13} className="text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-300 uppercase tracking-widest">On-Demand Bots</span>
            <span className="text-xs text-gray-600">{onDemandRows.length} bot{onDemandRows.length !== 1 ? "s" : ""}</span>
          </div>
          <BotTable rows={onDemandRows} showStartCol={false} {...tableProps} />
          <Legend />
        </div>
      )}

      {/* Tooltip / Error Modal / Side Sheet / Add Dialog */}
      {tooltip   && <CellTooltip tt={tooltip} />}
      {errorInfo && <ErrorModal info={errorInfo} onClose={() => setErrorInfo(null)} />}
      {sideSheet && (
        <SideSheet
          processName={sideSheet.processName}
          processDef={processDefMap.get(sideSheet.processName) ?? null}
          onClose={() => setSideSheet(null)}
          onRefresh={onRefresh}
        />
      )}
      <AddBotDialog open={showAdd} onClose={() => setShowAdd(false)} onRefresh={onRefresh} />
    </>
  );
}
