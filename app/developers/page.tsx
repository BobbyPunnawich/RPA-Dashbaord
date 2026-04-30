"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil, Trash2, Check, X, RefreshCw, Users } from "lucide-react";

interface Developer { id: number; fullName: string; email: string; createdAt: string }

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

export default function DevelopersPage() {
  const [devs,      setDevs]      = useState<Developer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/developers");
      if (r.ok) setDevs(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doDelete(id: number) {
    setDeleting(true);
    try {
      await fetch(`/api/developers/${id}`, { method: "DELETE" });
      setDeleteId(null);
      load();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  return (
    <div className="space-y-8">

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
              <ChevronLeft size={14} /> Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-indigo-400" />
            Developer Profiles
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage developers who can be assigned as bot owners.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={load} title="Refresh"
            className="p-2 rounded-xl border border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
            <Plus size={14} /> Add Developer
          </button>
        </div>
      </div>

      {!loading && (
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-white">{devs.length}</span> developer{devs.length !== 1 ? "s" : ""} registered
        </p>
      )}

      {showAdd && (
        <AddForm
          onAdded={() => { setShowAdd(false); load(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {loading ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-sm text-gray-500 animate-pulse">Loading…</div>
      ) : devs.length === 0 && !showAdd ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center space-y-2">
          <Users size={32} className="text-gray-700 mx-auto" />
          <p className="text-sm text-gray-500">No developers yet.</p>
          <button onClick={() => setShowAdd(true)} className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2">
            Add the first developer
          </button>
        </div>
      ) : devs.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Full Name</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Email</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Added</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devs.map((dev, i) => {
                const rowBg = i % 2 === 0 ? "" : "bg-gray-800/20";
                if (editId === dev.id) {
                  return (
                    <EditRow key={dev.id} dev={dev}
                      onSaved={() => { setEditId(null); load(); }}
                      onCancel={() => setEditId(null)}
                    />
                  );
                }
                return (
                  <tr key={dev.id} className={`border-b border-gray-800/50 ${rowBg}`}>
                    <td className="px-4 py-3 font-medium text-gray-100">{dev.fullName}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{dev.email}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {new Date(dev.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      {deleteId !== dev.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditId(dev.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-indigo-700 text-gray-300 hover:text-white text-xs font-medium transition-colors">
                            <Pencil size={11} /> Edit
                          </button>
                          <button onClick={() => setDeleteId(dev.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-300 text-xs transition-colors">
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">Delete developer?</span>
                          <button onClick={() => doDelete(dev.id)} disabled={deleting}
                            className="px-2.5 py-1 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                            {deleting ? "…" : "Yes"}
                          </button>
                          <button onClick={() => setDeleteId(null)}
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
      ) : null}
    </div>
  );
}

function AddForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/developers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
      onAdded();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-gray-900 border border-indigo-700/50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">New Developer</p>
        <button onClick={onCancel} className="text-gray-500 hover:text-white"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">Full Name *</label>
          <input className={inputCls} placeholder="e.g. Somchai Jaidee" value={fullName}
            onChange={e => setFullName(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">Email *</label>
          <input className={inputCls} type="email" placeholder="e.g. somchai@company.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">Cancel</button>
        <button onClick={save} disabled={saving || !fullName.trim() || !email.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
          {saving ? "Saving…" : "Add Developer"}
        </button>
      </div>
    </div>
  );
}

function EditRow({ dev, onSaved, onCancel }: { dev: Developer; onSaved: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(dev.fullName);
  const [email,    setEmail]    = useState(dev.email);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/developers/${dev.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
      onSaved();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <tr className="bg-indigo-950/30 border-b border-indigo-800/30">
      <td className="px-4 py-3">
        <input className={inputCls} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" />
      </td>
      <td className="px-4 py-3">
        <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">—</td>
      <td className="px-4 py-3">
        {error && <p className="text-[10px] text-red-400 mb-1">{error}</p>}
        <div className="flex gap-2">
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
