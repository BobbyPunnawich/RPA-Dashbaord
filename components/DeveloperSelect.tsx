"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, ChevronDown } from "lucide-react";

interface Developer { id: number; fullName: string; email: string }

interface Props {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  onCreateNew?: () => void;
}

export default function DeveloperSelect({ value, onChange, className, onCreateNew }: Props) {
  const [open, setOpen]           = useState(false);
  const [devs, setDevs]           = useState<Developer[]>([]);
  const ref                       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/developers")
      .then(r => r.ok ? r.json() : [])
      .then(setDevs)
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const displayLabel = value || "— Unassigned —";

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      >
        <span className={value ? "text-gray-100" : "text-gray-500"}>{displayLabel}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-800 ${!value ? "text-indigo-400 font-semibold" : "text-gray-400 italic"}`}
          >
            — Unassigned —
          </button>

          {devs.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-t border-gray-800">
              {devs.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { onChange(d.fullName); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 transition-colors hover:bg-gray-800 ${value === d.fullName ? "bg-indigo-900/30 text-indigo-300" : "text-gray-200"}`}
                >
                  <span className="block text-sm font-medium">{d.fullName}</span>
                  <span className="block text-[10px] text-gray-500">{d.email}</span>
                </button>
              ))}
            </div>
          )}

          {devs.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-600 italic border-t border-gray-800">No developers yet</p>
          )}

          <div className="border-t border-gray-700">
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateNew?.(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-indigo-400 hover:bg-indigo-900/20 transition-colors"
            >
              <UserPlus size={13} />
              Create Developer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
