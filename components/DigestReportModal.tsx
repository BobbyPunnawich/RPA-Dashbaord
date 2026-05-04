"use client";

import { useEffect, useState } from "react";
import { X, Send, FileText, CheckCircle, ChevronDown } from "lucide-react";

interface Developer { id: number; fullName: string; email: string }

interface SendRecipient { owner: string; email: string; bots: number; runs: number }

interface SendResult {
  sent:       number;
  recipients: SendRecipient[];
  skipped:    number;
}

interface Props {
  onClose:       () => void;
  initialFrom?:  string;  // pre-fill from the dashboard date range picker
  initialTo?:    string;
}

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 " +
  "placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors";

function todayStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function firstOfMonthStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default function DigestReportModal({ onClose, initialFrom, initialTo }: Props) {
  const [devs,    setDevs]    = useState<Developer[]>([]);
  const [from,    setFrom]    = useState(() => initialFrom ?? firstOfMonthStr());
  const [to,      setTo]      = useState(() => initialTo   ?? todayStr());
  const [owner,   setOwner]   = useState("all");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<SendResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  // Load developer list for the owner combobox
  useEffect(() => {
    fetch("/api/developers")
      .then((r) => (r.ok ? r.json() : []))
      .then(setDevs)
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch("/api/reports/digest", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ from, to, owner }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to send report."); return; }
      setResult(json as SendResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const selectedOwnerLabel =
    owner === "all"
      ? "All Owners"
      : devs.find((d) => d.fullName === owner)?.fullName ?? owner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal card */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/40 rounded-lg border border-indigo-700/40">
              <FileText size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Generate Digest Report</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Send a bot performance summary to owners by email
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5">

          {/* Date range */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-2">
              Reporting Period
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">From</p>
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">To</p>
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={todayStr()}
                  onChange={(e) => setTo(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Owner selector */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-2">
              Recipient
            </label>
            <div className="relative">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className={inputCls + " appearance-none cursor-pointer pr-8"}
              >
                <option value="all">All Owners — send to each individually</option>
                {devs.map((d) => (
                  <option key={d.id} value={d.fullName}>
                    {d.fullName} ({d.email})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">
              Only owners with a registered Developer profile will receive an email.
              Owners with no runs in the period are skipped.
            </p>
          </div>

          {/* Preview summary */}
          {!result && !error && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 flex items-start gap-3">
              <Send size={13} className="text-gray-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Will send a digest covering{" "}
                <span className="text-gray-200 font-medium">{from} → {to}</span>
                {" "}to{" "}
                <span className="text-gray-200 font-medium">
                  {owner === "all" ? `all registered owners (${devs.length} developers)` : selectedOwnerLabel}
                </span>.
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Result state */}
          {result && (
            <div className="bg-emerald-900/15 border border-emerald-700/40 rounded-lg px-4 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-emerald-300">
                  {result.sent === 0
                    ? "No emails sent"
                    : `${result.sent} digest email${result.sent !== 1 ? "s" : ""} sent successfully`}
                </p>
              </div>

              {result.recipients.length > 0 && (
                <div className="space-y-1.5 pl-1">
                  {result.recipients.map((r) => (
                    <div key={r.owner} className="flex items-baseline gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                      <span className="font-medium text-emerald-200">{r.owner}</span>
                      <span className="text-emerald-700">·</span>
                      <span className="text-gray-400">
                        {r.bots} bot{r.bots !== 1 ? "s" : ""}, {r.runs} run{r.runs !== 1 ? "s" : ""}
                      </span>
                      <span className="text-gray-600 font-mono text-[10px] ml-auto">{r.email}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.skipped > 0 && (
                <p className="text-xs text-yellow-500/80 pl-1">
                  {result.skipped} owner{result.skipped !== 1 ? "s" : ""} skipped —
                  no developer profile or no runs in the selected period.
                </p>
              )}
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={submit}
              disabled={loading || !from || !to}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              <Send size={13} />
              {loading ? "Sending…" : "Send Report"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
