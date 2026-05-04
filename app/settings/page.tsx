"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, Zap, Pencil, Trash2, X, Check, RefreshCw, Plus, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ProcessDefinition, BotType } from "@/types/rpa";
import DeveloperSelect from "@/components/DeveloperSelect";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(sec: number) {
  if (sec < 60)  return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

const selectCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

// ── Add Bot Form ──────────────────────────────────────────────────────────────
interface AddFormState {
  processName: string;
  owner: string;
  botType: BotType;
  expectedStartTime: string;
  slaMaxDuration: string;
}

function AddBotRow({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AddFormState>({
    processName: "", owner: "", botType: "OnDemand",
    expectedStartTime: "08:00", slaMaxDuration: "1800",
  });

  function reset() {
    setForm({ processName: "", owner: "", botType: "OnDemand", expectedStartTime: "08:00", slaMaxDuration: "1800" });
    setError(null);
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processName:       form.processName.trim(),
          owner:             form.owner.trim() || "Unassigned",
          botType:           form.botType,
          expectedStartTime: form.botType === "Scheduled" ? form.expectedStartTime : "",
          slaMaxDuration:    Math.max(0, parseInt(form.slaMaxDuration) || 0),
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed to add bot."); return; }
      reset(); setOpen(false); onAdded();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
      >
        <Plus size={14} /> Add Bot
      </button>
    );
  }

  return (
    <div className="bg-gray-900 border border-indigo-700/50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-white">Register New Bot</p>
        <button onClick={() => { reset(); setOpen(false); }} className="text-gray-500 hover:text-white"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">Process Name *</label>
          <input className={inputCls} placeholder="e.g. Pandora Report" value={form.processName} onChange={e => setForm(f => ({ ...f, processName: e.target.value }))} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">Owner</label>
          <DeveloperSelect
            value={form.owner}
            onChange={v => setForm(f => ({ ...f, owner: v }))}
            onCreateNew={() => { window.open("/developers", "_blank"); }}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">Bot Type</label>
          <select className={selectCls} value={form.botType} onChange={e => setForm(f => ({ ...f, botType: e.target.value as BotType }))}>
            <option value="OnDemand">On-Demand</option>
            <option value="Scheduled">Scheduled</option>
          </select>
        </div>
        {form.botType === "Scheduled" && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">Expected Start (HH:MM)</label>
            <input className={inputCls} type="time" value={form.expectedStartTime} onChange={e => setForm(f => ({ ...f, expectedStartTime: e.target.value }))} />
          </div>
        )}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">SLA Max Duration (seconds)</label>
          <input className={inputCls} type="number" min={1} value={form.slaMaxDuration} onChange={e => setForm(f => ({ ...f, slaMaxDuration: e.target.value }))} />
          <p className="text-[10px] text-gray-600 mt-1">{fmtDuration(parseInt(form.slaMaxDuration) || 0)}</p>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={() => { reset(); setOpen(false); }} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">Cancel</button>
        <button onClick={save} disabled={saving || !form.processName.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {saving ? "Saving…" : "Register Bot"}
        </button>
      </div>
    </div>
  );
}

// ── Edit Row ──────────────────────────────────────────────────────────────────
interface EditFormState {
  owner: string;
  botType: BotType;
  expectedStartTime: string;
  slaMaxDuration: string;
}

interface EditRowProps {
  proc: ProcessDefinition;
  onSaved: () => void;
  onCancel: () => void;
}

function EditRow({ proc, onSaved, onCancel }: EditRowProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [form, setForm]     = useState<EditFormState>({
    owner:             proc.owner || "",
    botType:           proc.botType as BotType,
    expectedStartTime: proc.expectedStartTime || "08:00",
    slaMaxDuration:    String(proc.slaMaxDuration),
  });

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/processes/${proc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner:             form.owner.trim() || "Unassigned",
          botType:           form.botType,
          expectedStartTime: form.botType === "Scheduled" ? form.expectedStartTime : "",
          slaMaxDuration:    Math.max(0, parseInt(form.slaMaxDuration) || 0),
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Save failed."); return; }
      onSaved();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <tr className="bg-indigo-950/30 border-b border-indigo-800/30">
      <td className="px-4 py-4 font-medium text-white text-sm" colSpan={1}>
        <span className="text-indigo-300 font-semibold">{proc.processName}</span>
      </td>
      <td className="px-4 py-4">
        <DeveloperSelect
          value={form.owner}
          onChange={v => setForm(f => ({ ...f, owner: v }))}
          onCreateNew={() => { window.open("/developers", "_blank"); }}
        />
      </td>
      <td className="px-4 py-4">
        <select className={selectCls} value={form.botType}
          onChange={e => setForm(f => ({ ...f, botType: e.target.value as BotType }))}>
          <option value="OnDemand">On-Demand</option>
          <option value="Scheduled">Scheduled</option>
        </select>
      </td>
      <td className="px-4 py-4">
        {form.botType === "Scheduled"
          ? <input className={inputCls} type="time" value={form.expectedStartTime}
              onChange={e => setForm(f => ({ ...f, expectedStartTime: e.target.value }))} />
          : <span className="text-xs text-gray-600 italic">N/A</span>}
      </td>
      <td className="px-4 py-4">
        <input className={inputCls} type="number" min={1} value={form.slaMaxDuration}
          onChange={e => setForm(f => ({ ...f, slaMaxDuration: e.target.value }))} />
        <p className="text-[10px] text-gray-600 mt-1">{fmtDuration(parseInt(form.slaMaxDuration) || 0)}</p>
      </td>
      <td className="px-4 py-4">
        {error && <p className="text-[10px] text-red-400 mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
            <Check size={12} /> {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors">
            <X size={12} /> Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [processes,   setProcesses]   = useState<ProcessDefinition[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editId,      setEditId]      = useState<number | null>(null);
  const [deleteId,    setDeleteId]    = useState<number | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/processes");
      if (res.ok) setProcesses(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  async function doDelete(id: number) {
    setDeleting(true);
    try {
      await fetch(`/api/processes/${id}`, { method: "DELETE" });
      setDeleteId(null);
      fetchProcesses();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  const scheduled = processes.filter(p => p.botType === "Scheduled");
  const onDemand  = processes.filter(p => p.botType === "OnDemand");

  return (
    <div className="space-y-8">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
              <ChevronLeft size={14} /> Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-bold text-white">Bot Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage process definitions, SLA thresholds, and bot ownership.
            Auto-registered bots appear here after their first run.
          </p>
        </div>
        <button onClick={fetchProcesses} title="Refresh" className="p-2 mt-1 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Add Bot ──────────────────────────────────────────────────────────── */}
      <div id="tour-add-bot">
        <AddBotRow onAdded={fetchProcesses} />
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      {!loading && (
        <>
          <div className="flex gap-4 text-sm text-gray-400">
            <span><span className="font-semibold text-white">{processes.length}</span> total bots</span>
            <span><span className="font-semibold text-indigo-300">{scheduled.length}</span> scheduled</span>
            <span><span className="font-semibold text-yellow-300">{onDemand.length}</span> on-demand</span>
          </div>
          {processes.filter(p => p.slaMaxDuration === 0).length > 0 && (
            <div className="flex items-center gap-3 bg-amber-900/25 border border-amber-700/50 rounded-xl px-4 py-3">
              <span className="text-amber-400 text-lg leading-none">⚠</span>
              <div>
                <p className="text-xs font-semibold text-amber-400">
                  {processes.filter(p => p.slaMaxDuration === 0).length} bot{processes.filter(p => p.slaMaxDuration === 0).length !== 1 ? "s" : ""} without SLA configured
                </p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">
                  Click Edit on each highlighted row below to set the SLA max duration.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div id="tour-bot-registry">
      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-500 animate-pulse">Loading…</div>
      ) : processes.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-500">
          No bots registered yet. Add one above or let PAD auto-register by sending a log.
        </div>
      ) : (
        <>
          {/* ── Scheduled section ──────────────────────────────────────────── */}
          {scheduled.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Clock size={13} className="text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Scheduled Bots</span>
                <span className="text-xs text-gray-600">{scheduled.length}</span>
              </div>
              <BotTable
                rows={scheduled} editId={editId} deleteId={deleteId} deleting={deleting}
                onEdit={id => setEditId(id === editId ? null : id)}
                onCancelEdit={() => setEditId(null)}
                onSaved={() => { setEditId(null); fetchProcesses(); }}
                onDeleteRequest={id => setDeleteId(id === deleteId ? null : id)}
                onDeleteConfirm={doDelete}
                onDeleteCancel={() => setDeleteId(null)}
              />
            </section>
          )}

          {/* ── On-Demand section ──────────────────────────────────────────── */}
          {onDemand.length > 0 && (
            <section className={scheduled.length > 0 ? "mt-2" : ""}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Zap size={13} className="text-yellow-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-yellow-300">On-Demand Bots</span>
                <span className="text-xs text-gray-600">{onDemand.length}</span>
              </div>
              <BotTable
                rows={onDemand} editId={editId} deleteId={deleteId} deleting={deleting}
                onEdit={id => setEditId(id === editId ? null : id)}
                onCancelEdit={() => setEditId(null)}
                onSaved={() => { setEditId(null); fetchProcesses(); }}
                onDeleteRequest={id => setDeleteId(id === deleteId ? null : id)}
                onDeleteConfirm={doDelete}
                onDeleteCancel={() => setDeleteId(null)}
              />
            </section>
          )}
        </>
      )}
      </div>{/* /tour-bot-registry */}
    </div>
  );
}

// ── Shared Table Component ────────────────────────────────────────────────────
interface BotTableProps {
  rows: ProcessDefinition[];
  editId: number | null;
  deleteId: number | null;
  deleting: boolean;
  onEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleteRequest: (id: number) => void;
  onDeleteConfirm: (id: number) => void;
  onDeleteCancel: () => void;
}

function BotTable({ rows, editId, deleteId, deleting, onEdit, onCancelEdit, onSaved, onDeleteRequest, onDeleteConfirm, onDeleteCancel }: BotTableProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Process Name</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Owner</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Bot Type</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Expected Start</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">SLA Max</th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((proc, i) => {
            const isEditing  = editId === proc.id;
            const isDeleting = deleteId === proc.id;
            const rowBg      = i % 2 === 0 ? "" : "bg-gray-800/20";

            if (isEditing) {
              return <EditRow key={proc.id} proc={proc} onSaved={onSaved} onCancel={onCancelEdit} />;
            }

            return (
              <tr key={proc.id} className={`border-b border-gray-800/50 ${proc.slaMaxDuration === 0 ? "bg-amber-950/20" : rowBg} transition-colors`}>
                {/* Process Name */}
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-100">{proc.processName}</span>
                  <span className="block text-[10px] text-gray-600 mt-0.5 font-mono">id:{proc.id}</span>
                </td>
                {/* Owner */}
                <td className="px-4 py-3 text-sm text-gray-300">
                  {proc.owner || <span className="text-gray-600 italic">Unassigned</span>}
                </td>
                {/* Bot Type */}
                <td className="px-4 py-3">
                  {proc.botType === "Scheduled"
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-900/40 text-indigo-300 border border-indigo-700"><Clock size={9} />Scheduled</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-900/30 text-yellow-300 border border-yellow-700"><Zap size={9} />On-Demand</span>}
                </td>
                {/* Expected Start */}
                <td className="px-4 py-3 font-mono text-sm text-gray-400">
                  {proc.botType === "Scheduled" && proc.expectedStartTime
                    ? proc.expectedStartTime
                    : <span className="text-gray-600">—</span>}
                </td>
                {/* SLA */}
                <td className="px-4 py-3 text-sm">
                  {proc.slaMaxDuration === 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-xs">
                      ⚠ Not set — click Edit
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      {fmtDuration(proc.slaMaxDuration)}
                      <span className="text-gray-600 text-xs ml-1">({proc.slaMaxDuration}s)</span>
                    </span>
                  )}
                </td>
                {/* Actions */}
                <td className="px-4 py-3">
                  {!isDeleting ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(proc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-indigo-700 text-gray-300 hover:text-white text-xs font-medium transition-colors">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => onDeleteRequest(proc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-300 text-xs transition-colors">
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">Delete all logs?</span>
                      <button onClick={() => onDeleteConfirm(proc.id)} disabled={deleting}
                        className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                        {deleting ? "…" : "Yes"}
                      </button>
                      <button onClick={onDeleteCancel}
                        className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition-colors">
                        No
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
