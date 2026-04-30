"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users } from "lucide-react";

export default function NavBar() {
  const pathname = usePathname();

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
      <Link href="/developers" className={navCls("/developers")}>
        <Users size={13} />
        Developer Profile
      </Link>
      <Link href="/settings" className={navCls("/settings")}>
        <Settings size={13} />
        Bot Settings
      </Link>
    </nav>
  );
}
