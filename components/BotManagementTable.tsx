"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import DurationChart from "@/components/DurationChart";
import { ProcessDefinition } from "@/types/rpa";

interface Props {
  processes: ProcessDefinition[];
  from: string;
  to: string;
  onRefresh: () => void;
}

type DialogMode = "add" | "edit" | null;

interface FormState {
  processName: string;
  owner: string;
  expectedStartTime: string;
  slaMaxDuration: string; // keep as string for input
}

const EMPTY_FORM: FormState = {
  processName: "",
  owner: "",
  expectedStartTime: "08:00",
  slaMaxDuration: "3600",
};

function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Confirmation Modal ───────────────────────────────────────────────────────
function ConfirmDelete({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-gray-900 border border-red-800/60 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-1">
          Confirm Delete
        </p>
        <h3 className="text-base font-bold text-white mb-2">
          Delete &ldquo;{name}&rdquo;?
        </h3>
        <p className="text-sm text-gray-400 mb-5">
          This will permanently delete the process and{" "}
          <strong className="text-red-400">all associated run logs</strong>. This
          action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form Fields ──────────────────────────────────────────────────────────────
function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

// ── Main Component ───────────────────────────────────────────────────────────
export default function BotManagementTable({ processes, from, to, onRefresh }: Props) {
  const [expandedProcess, setExpandedProcess] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingProcess, setEditingProcess] = useState<ProcessDefinition | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deletingProcess, setDeletingProcess] = useState<ProcessDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingProcess(null);
    setError(null);
    setDialogMode("add");
  }

  function openEdit(p: ProcessDefinition) {
    setForm({
      processName: p.processName,
      owner: p.owner,
      expectedStartTime: p.expectedStartTime,
      slaMaxDuration: String(p.slaMaxDuration),
    });
    setEditingProcess(p);
    setError(null);
    setDialogMode("edit");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const body = {
      processName: form.processName.trim(),
      owner: form.owner.trim(),
      expectedStartTime: form.expectedStartTime,
      slaMaxDuration: parseInt(form.slaMaxDuration) || 3600,
    };

    try {
      let res: Response;
      if (dialogMode === "add") {
        res = await fetch("/api/processes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/processes/${editingProcess!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: body.owner,
            expectedStartTime: body.expectedStartTime,
            slaMaxDuration: body.slaMaxDuration,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }

      setDialogMode(null);
      onRefresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: ProcessDefinition) {
    try {
      const res = await fetch(`/api/processes/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeletingProcess(null);
      onRefresh();
    } catch {
      setDeletingProcess(null);
    }
  }

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-white">Bot Registry</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {processes.length} registered bot{processes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={14} />
          Add Bot
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {processes.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            No bots registered yet.{" "}
            <button
              onClick={openAdd}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Add the first one
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-gray-400 font-semibold w-6" />
                <th className="px-4 py-3 text-gray-400 font-semibold">Process Name</th>
                <th className="px-4 py-3 text-gray-400 font-semibold">Owner</th>
                <th className="px-4 py-3 text-gray-400 font-semibold">Expected Start</th>
                <th className="px-4 py-3 text-gray-400 font-semibold">SLA Max Duration</th>
                <th className="px-4 py-3 text-gray-400 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p, i) => {
                const isExpanded = expandedProcess === p.processName;
                return (
                  <>
                    <tr
                      key={p.processName}
                      className={`border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors ${
                        i % 2 === 1 ? "bg-gray-800/20" : ""
                      }`}
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setExpandedProcess(isExpanded ? null : p.processName)
                          }
                          className="text-gray-500 hover:text-gray-200 transition-colors"
                          title="View duration chart"
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                      </td>
                      <td
                        className="px-4 py-3 font-semibold text-gray-100 cursor-pointer hover:text-indigo-300 transition-colors"
                        onClick={() =>
                          setExpandedProcess(isExpanded ? null : p.processName)
                        }
                      >
                        {p.processName}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {p.owner || <span className="text-gray-600 italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {p.expectedStartTime}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {fmtDuration(p.slaMaxDuration)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-900/30 transition-colors"
                            title="Edit SLA settings"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingProcess(p)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                            title="Delete process"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded chart row */}
                    {isExpanded && (
                      <tr key={`${p.processName}-chart`} className="bg-gray-800/40 border-b border-gray-800/60">
                        <td colSpan={6} className="px-6 py-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                            Daily Avg Duration vs SLA Limit — {p.processName}
                          </p>
                          <DurationChart
                            processName={p.processName}
                            from={from}
                            to={to}
                            slaMaxDuration={p.slaMaxDuration}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Register New Bot" : `Edit — ${editingProcess?.processName}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "add"
                ? "Add a new RPA process and configure its SLA thresholds."
                : "Update the SLA configuration for this process."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {dialogMode === "add" && (
              <FormField label="Process Name">
                <input
                  className={inputCls}
                  placeholder="e.g. Pandora Report"
                  value={form.processName}
                  onChange={(e) => setForm((f) => ({ ...f, processName: e.target.value }))}
                />
              </FormField>
            )}

            <FormField label="Owner">
              <input
                className={inputCls}
                placeholder="e.g. Operations Team"
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              />
            </FormField>

            <FormField label="Expected Start Time (HH:MM)">
              <input
                className={inputCls}
                type="time"
                value={form.expectedStartTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expectedStartTime: e.target.value }))
                }
              />
            </FormField>

            <FormField label="SLA Max Duration (seconds)">
              <input
                className={inputCls}
                type="number"
                min={1}
                placeholder="3600"
                value={form.slaMaxDuration}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slaMaxDuration: e.target.value }))
                }
              />
              {form.slaMaxDuration && (
                <p className="text-xs text-gray-600">
                  = {fmtDuration(parseInt(form.slaMaxDuration) || 0)}
                </p>
              )}
            </FormField>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors">
                Cancel
              </button>
            </DialogClose>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {saving ? "Saving…" : dialogMode === "add" ? "Register Bot" : "Save Changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      {deletingProcess && (
        <ConfirmDelete
          name={deletingProcess.processName}
          onConfirm={() => handleDelete(deletingProcess)}
          onCancel={() => setDeletingProcess(null)}
        />
      )}
    </section>
  );
}
