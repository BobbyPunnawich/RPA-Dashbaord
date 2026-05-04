"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, RefreshCw, CheckCircle2, Circle, AlertTriangle,
  Save, X, Clock, Zap,
} from "lucide-react";
import { ProcessDefinition, BotType } from "@/types/rpa";
import DeveloperSelect from "@/components/DeveloperSelect";

function fmtDuration(sec: number) {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 " +
  "placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

interface BotIssue {
  noOwner: boolean;
  noSLA:   boolean;
}

function issues(p: ProcessDefinition): BotIssue {
  return {
    noOwner: !p.owner || p.owner === "Unassigned",
    noSLA:   p.slaMaxDuration === 0,
  };
}

function hasIssue(p: ProcessDefinition): boolean {
  const { noOwner, noSLA } = issues(p);
  return noOwner || noSLA;
}

// ── Single bot card ───────────────────────────────────────────────────────────
interface CardProps {
  proc:     ProcessDefinition;
  onSaved:  (updated: ProcessDefinition) => void;
}

function BotCard({ proc, onSaved }: CardProps) {
  const { noOwner, noSLA } = issues(proc);

  const [owner,     setOwner]     = useState(proc.owner === "Unassigned" ? "" : proc.owner);
  const [botType,   setBotType]   = useState<BotType>(proc.botType);
  const [slaInput,  setSlaInput]  = useState(proc.slaMaxDuration > 0 ? String(proc.slaMaxDuration) : "");
  const [startTime, setStartTime] = useState(proc.expectedStartTime || "08:00");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    const sla = parseInt(slaInput, 10);
    if (isNaN(sla) || sla < 0) { setError("SLA must be a valid number of seconds"); setSaving(false); return; }
    try {
      const res = await fetch(`/api/processes/${proc.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner:             owner.trim() || "Unassigned",
          botType,
          expectedStartTime: botType === "Scheduled" ? startTime : "",
          slaMaxDuration:    sla,
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Save failed"); return; }
      onSaved(await res.json());
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  const isDirty =
    (owner.trim() || "Unassigned") !== proc.owner ||
    botType !== proc.botType ||
    Number(slaInput) !== proc.slaMaxDuration ||
    (botType === "Scheduled" && startTime !== proc.expectedStartTime);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-800">
        <div className="min-w-0">
          <Link
            href={`/process/${encodeURIComponent(proc.processName)}`}
            className="text-sm font-bold text-white hover:text-indigo-300 transition-colors break-all"
          >
            {proc.processName}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {noOwner && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/50 text-amber-400">
                <AlertTriangle size={9} /> No Owner
              </span>
            )}
            {noSLA && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-900/30 border border-orange-700/50 text-orange-400">
                <AlertTriangle size={9} /> No SLA
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="px-5 py-4 space-y-4">

        {/* Checklist */}
        <div className="space-y-2">
          <CheckItem
            done={!noOwner}
            label="Assign Owner"
            hint={!noOwner ? `Owner: ${proc.owner}` : "Who is responsible for this bot?"}
          />
          <CheckItem
            done={!noSLA}
            label="Set SLA Max Duration"
            hint={!noSLA ? `SLA: ${fmtDuration(proc.slaMaxDuration)}` : "Max allowed run duration"}
          />
          <CheckItem
            done
            label="Bot Type"
            hint={`Currently: ${proc.botType}`}
          />
        </div>

        <hr className="border-gray-800" />

        {/* Owner */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">
            Owner {noOwner && <span className="text-amber-400 ml-1">*</span>}
          </label>
          <DeveloperSelect value={owner} onChange={setOwner} />
        </div>

        {/* Bot Type */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Bot Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBotType("OnDemand")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                botType === "OnDemand"
                  ? "bg-indigo-900/40 border-indigo-600 text-indigo-300"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              <Zap size={11} /> On Demand
            </button>
            <button
              onClick={() => setBotType("Scheduled")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                botType === "Scheduled"
                  ? "bg-indigo-900/40 border-indigo-600 text-indigo-300"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              <Clock size={11} /> Scheduled
            </button>
          </div>
          {botType === "Scheduled" && (
            <div className="mt-2">
              <label className="text-[10px] text-gray-500 block mb-1">Expected Start Time (HH:MM)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls + " max-w-[140px]"}
              />
            </div>
          )}
        </div>

        {/* SLA */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">
            SLA Max Duration (seconds) {noSLA && <span className="text-orange-400 ml-1">*</span>}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="e.g. 1800 = 30 min"
              value={slaInput}
              onChange={(e) => setSlaInput(e.target.value)}
              className={inputCls + " max-w-[180px]"}
            />
            {slaInput && !isNaN(Number(slaInput)) && Number(slaInput) > 0 && (
              <span className="text-xs text-gray-500 shrink-0">= {fmtDuration(Number(slaInput))}</span>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || !isDirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            <Save size={13} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {isDirty && !saving && (
            <button
              onClick={() => {
                setOwner(proc.owner === "Unassigned" ? "" : proc.owner);
                setBotType(proc.botType);
                setSlaInput(proc.slaMaxDuration > 0 ? String(proc.slaMaxDuration) : "");
                setStartTime(proc.expectedStartTime || "08:00");
                setError(null);
              }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
            >
              <X size={11} /> Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckItem({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      {done
        ? <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
        : <Circle       size={14} className="text-gray-600   mt-0.5 shrink-0" />
      }
      <div>
        <span className={`text-xs font-semibold ${done ? "text-gray-400 line-through" : "text-gray-200"}`}>{label}</span>
        <span className="text-[10px] text-gray-600 ml-2">{hint}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const [procs,   setProcs]   = useState<ProcessDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/processes");
      if (r.ok) setProcs(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(updated: ProcessDefinition) {
    setProcs((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  const incomplete = procs.filter(hasIssue);
  const done       = procs.length - incomplete.length;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div id="tour-setup-header" className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
              <ChevronLeft size={14} /> Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-400" />
            Bot Setup Checklist
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete the setup for each bot so it can be properly monitored and notifications can be sent.
          </p>
        </div>
        <button
          onClick={load}
          title="Refresh"
          className="p-2 mt-1 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Progress bar */}
      {!loading && procs.length > 0 && (
        <div id="tour-setup-progress" className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              <span className="font-bold text-white">{done}</span> of {procs.length} bots fully configured
            </span>
            <span className={`font-semibold ${incomplete.length === 0 ? "text-emerald-400" : "text-amber-400"}`}>
              {incomplete.length === 0 ? "All done!" : `${incomplete.length} need${incomplete.length === 1 ? "s" : ""} attention`}
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: procs.length > 0 ? `${Math.round((done / procs.length) * 100)}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-500 animate-pulse">
          Loading bots…
        </div>
      )}

      {!loading && incomplete.length === 0 && procs.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center space-y-2">
          <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
          <p className="text-base font-bold text-white">All bots are fully configured!</p>
          <p className="text-sm text-gray-500">
            Every bot has an owner assigned and an SLA set.
          </p>
          <Link href="/settings" className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2">
            Go to Bot Settings
          </Link>
        </div>
      )}

      {!loading && incomplete.length === 0 && procs.length === 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-10 text-center">
          <p className="text-sm text-gray-500">No bots registered yet.</p>
          <Link href="/settings" className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2">
            Add bots in Bot Settings
          </Link>
        </div>
      )}

      {!loading && incomplete.length > 0 && (
        <div id="tour-setup-cards" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incomplete.map((p) => (
            <BotCard key={p.id} proc={p} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
