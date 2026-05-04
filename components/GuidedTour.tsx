"use client";

import type { DriveStep } from "driver.js";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";

const TOUR_KEY = "rpa_tour_seen";

// ── Step definitions — one function per page ───────────────────────────────────
// Steps are built at call-time so DOM-presence checks reflect actual page state.

function dashboardSteps(): DriveStep[] {
  const hasIssues = !!document.querySelector("#tour-issues .overflow-x-auto");

  const steps: DriveStep[] = [
    {
      popover: {
        title: "Welcome to RPA Control Center",
        description:
          "This quick tour covers every key feature in under 2 minutes.\n\nUse the arrow buttons to navigate — or press Escape to exit at any time.",
        align: "center",
      },
    },
    {
      element: "#tour-today-summary",
      popover: {
        title: "Today's Summary",
        description:
          "Your live command center for today's activity. The donut chart shows every run broken down by status. The KPI cards show the overall success rate, average run time, and SLA compliance — all scoped to today only.",
        side: "bottom",
        align: "start",
      },
    },
  ];

  if (hasIssues) {
    steps.push({
      element: "#tour-issues",
      popover: {
        title: "Issues Today",
        description:
          "When a bot fails, breaches its SLA, or starts late, it appears here automatically — sorted by severity. Click any error message to view the full stack trace, or click View → to open that bot's complete run history.",
        side: "bottom",
        align: "start",
      },
    });
  }

  steps.push(
    {
      element: "#tour-filters",
      popover: {
        title: "Date Range & Search",
        description:
          "Change the date range to explore any historical period. Search by bot name or owner to narrow the matrix. Use the Send Report to My Email button on the right to email a digest covering the current date range.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-matrix",
      popover: {
        title: "Operational Matrix",
        description:
          "Each row is a bot, each column is a calendar day. Cell colour shows the worst run status for that day:\n\n🟢 Green — Success\n🟡 Yellow — Late Start\n🟠 Orange — SLA Breach\n🔴 Red — Failed\n\nA badge like 3× means the bot ran multiple times. Click any cell for details.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "#tour-nav-setup",
      popover: {
        title: "Bot Setup Checklist",
        description:
          "The amber badge shows how many bots still need configuration. Click here to open the Setup Checklist — a task-list view of every bot that is missing an owner or an SLA limit.\n\nCompleting setup unlocks failure alerts and SLA breach detection for those bots.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#tour-nav-settings",
      popover: {
        title: "Bot Settings",
        description:
          "Full bot management lives here: add new bots, assign owners, set SLA limits, and switch between On-Demand and Scheduled types.\n\nOwners receive automatic email notifications on every run completion — success, failure, SLA breach, or late start.",
        side: "bottom",
        align: "end",
      },
    }
  );

  return steps;
}

function settingsSteps(): DriveStep[] {
  return [
    {
      element: "#tour-bot-registry",
      popover: {
        title: "Bot Registry",
        description:
          "Every bot that sends logs to RPA Control Center is listed here, grouped by type. Bots are auto-registered on their first run — you then assign an owner and SLA limit to unlock full monitoring.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-add-bot",
      popover: {
        title: "Register a New Bot",
        description:
          "Click Add Bot to pre-register a bot before it runs. Choose between:\n\n⏱ Scheduled — runs on a fixed schedule. Late Start detection is enabled.\n⚡ On-Demand — triggered manually or by an event. No schedule tracking.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-bot-registry",
      popover: {
        title: "Owner & SLA Assignment",
        description:
          "Click Edit on any bot row to configure it:\n\n👤 Owner — the developer who receives automatic failure alert emails when this bot fails.\n\n⏱ SLA Max — the maximum allowed run duration in seconds. Exceeding it flags the run as an SLA Breach on the dashboard.",
        side: "top",
        align: "start",
      },
    },
  ];
}

function developersSteps(): DriveStep[] {
  const hasTable = !!document.querySelector("#tour-devs-table");

  const steps: DriveStep[] = [
    {
      element: "#tour-devs-header",
      popover: {
        title: "Developer Profiles",
        description:
          "Developers registered here can be assigned as bot owners. When a bot they own fails, they automatically receive a failure alert email at the address on their profile.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-add-developer",
      popover: {
        title: "Adding a Developer",
        description:
          "Click Add Developer to register a team member with their full name and email. Their name will then appear in the Owner dropdown in Bot Settings, and they'll start receiving failure alerts for any bots assigned to them.",
        side: "bottom",
        align: "end",
      },
    },
  ];

  if (hasTable) {
    steps.push({
      element: "#tour-devs-table",
      popover: {
        title: "Developer Directory",
        description:
          "All registered developers are listed here. Click Edit to update a name or email address. Removing a developer does not automatically reassign their bots — update each bot's Owner field in Bot Settings separately.",
        side: "top",
        align: "start",
      },
    });
  }

  return steps;
}

function processDetailSteps(): DriveStep[] {
  const hasCharts = !!document.querySelector("#tour-process-charts");

  const steps: DriveStep[] = [
    {
      element: "#tour-process-kpis",
      popover: {
        title: "Bot Performance Snapshot",
        description:
          "Lifetime stats for this bot: total runs, today's run count, success rate, failure count, and average run time. The SLA Max card is editable — click the pencil icon to update the limit without leaving this page.",
        side: "bottom",
        align: "start",
      },
    },
  ];

  if (hasCharts) {
    steps.push({
      element: "#tour-process-charts",
      popover: {
        title: "Performance Charts",
        description:
          "Daily Run Chart shows run frequency and status over time. Error Bubble Chart plots failures by date — bubble size represents how many times the same error repeated. Use these to spot patterns and recurring failures.",
        side: "bottom",
        align: "start",
      },
    });
  }

  steps.push({
    element: "#tour-process-runs",
    popover: {
      title: "Full Run History",
      description:
        "Every run this bot has made, newest first. Click any red Failed row to expand the full error message and screenshot link directly in the table. Rows with an SLA Breach or Late Start are highlighted in orange or yellow.",
      side: "top",
      align: "start",
    },
  });

  return steps;
}

function setupSteps(): DriveStep[] {
  const hasProgress = !!document.querySelector("#tour-setup-progress");
  const hasCards    = !!document.querySelector("#tour-setup-cards");

  const steps: DriveStep[] = [
    {
      element: "#tour-setup-header",
      popover: {
        title: "Bot Setup Checklist",
        description:
          "This page shows every bot that is missing critical configuration. A bot must have an Owner assigned and an SLA limit set before it can send failure alerts and detect SLA breaches on the dashboard.",
        side: "bottom",
        align: "start",
      },
    },
  ];

  if (hasProgress) {
    steps.push({
      element: "#tour-setup-progress",
      popover: {
        title: "Configuration Progress",
        description:
          "The progress bar shows how many of your bots are fully configured. The number on the right tells you how many still need attention. Work through the cards below to complete the setup.",
        side: "bottom",
        align: "start",
      },
    });
  }

  if (hasCards) {
    steps.push({
      element: "#tour-setup-cards",
      popover: {
        title: "Incomplete Bot Cards",
        description:
          "Each card represents a bot that needs attention. The checklist at the top of each card shows exactly which fields are missing.\n\n👤 Assign Owner — select the developer who receives email alerts for this bot.\n⏱ Set SLA Max — enter the max allowed run time in seconds.\n⚡ / 🕐 Bot Type — confirm whether the bot runs on-demand or on a fixed schedule.\n\nClick Save Changes when done. The card disappears once all fields are complete.",
        side: "top",
        align: "start",
      },
    });
  }

  steps.push({
    element: "#tour-nav-settings",
    popover: {
      title: "More in Bot Settings",
      description:
        "For full bot management — adding new bots, renaming, deleting, or editing all fields at once — visit the Bot Settings page.\n\nThe Setup Checklist only shows bots with incomplete configuration. Bot Settings shows everything.",
      side: "bottom",
      align: "end",
    },
  });

  return steps;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GuidedTour() {
  const pathname = usePathname();
  const [tourSeen, setTourSeen] = useState(true); // true by default to avoid SSR flicker

  useEffect(() => {
    setTourSeen(!!localStorage.getItem(TOUR_KEY));
  }, []);

  const launch = useCallback(async (steps: DriveStep[]) => {
    const { driver } = await import("driver.js");
    const driverObj = driver({
      showProgress:   true,
      animate:        true,
      stagePadding:   6,
      stageRadius:    10,
      allowClose:     true,
      overlayOpacity: 0.72,
      popoverClass:   "rpa-tour-popover",
      onDestroyStarted() { driverObj.destroy(); },
      steps,
    });
    driverObj.drive();
  }, []);

  const startTour = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setTourSeen(true);

    if (pathname === "/settings") {
      launch(settingsSteps());
    } else if (pathname === "/developers") {
      launch(developersSteps());
    } else if (pathname === "/setup") {
      launch(setupSteps());
    } else if (pathname.startsWith("/process/")) {
      launch(processDetailSteps());
    } else {
      launch(dashboardSteps());
    }
  }, [pathname, launch]);

  // Auto-start on first visit to the dashboard
  useEffect(() => {
    if (pathname !== "/") return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => launch(dashboardSteps()), 2200);
    return () => clearTimeout(t);
  }, [pathname, launch]);

  return (
    <button
      onClick={startTour}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      title="Start guided tour for this page"
    >
      <BookOpen size={13} />
      <span className="hidden sm:inline">Guided Tour</span>

      {!tourSeen && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
        </span>
      )}
    </button>
  );
}
