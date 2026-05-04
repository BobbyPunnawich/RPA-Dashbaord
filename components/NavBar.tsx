"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import GuidedTour from "@/components/GuidedTour";
import { ProcessDefinition } from "@/types/rpa";

export default function NavBar() {
  const pathname = usePathname();
  const [incompleteCount, setIncompleteCount] = useState(0);

  useEffect(() => {
    fetch("/api/processes")
      .then((r) => (r.ok ? r.json() : []))
      .then((procs: ProcessDefinition[]) => {
        setIncompleteCount(
          procs.filter(
            (p) => p.owner === "Unassigned" || p.slaMaxDuration === 0,
          ).length,
        );
      })
      .catch(() => {});
  }, [pathname]); // re-check whenever user navigates

  function navCls(href: string) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
      active
        ? "bg-gray-800 text-white"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;
  }

  return (
    <nav className="ml-auto flex items-center gap-1">
      <GuidedTour />
      <Link href="/developers" className={navCls("/developers")}>
        <Users size={13} />
        Developer Profile
      </Link>
      <Link id="tour-nav-setup" href="/setup" className={`${navCls("/setup")} relative`}>
        <AlertTriangle size={13} />
        Bot Setup
        {incompleteCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[9px] font-bold text-black leading-none">
            {incompleteCount}
          </span>
        )}
      </Link>
      <Link id="tour-nav-settings" href="/settings" className={navCls("/settings")}>
        <Settings size={13} />
        Bot Settings
      </Link>
    </nav>
  );
}
