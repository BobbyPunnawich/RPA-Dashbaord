export type BotType = "Scheduled" | "OnDemand";

export interface ProcessDefinition {
  id: number;
  processName: string;
  owner: string;
  botType: BotType;
  expectedStartTime: string; // "HH:MM" — relevant only for Scheduled bots
  slaMaxDuration: number;    // seconds
  createdAt: string;
}

export interface LogPayload {
  processName: string;
  status: "Success" | "Failed";
  startTime: string;      // ISO 8601
  endTime: string;        // ISO 8601 — durationSec calculated server-side
  runBy?: string;         // who triggered the run
  errorCode?: string;     // short error code e.g. "TIMEOUT"
  errorMessage?: string;  // full error description (required when status="Failed")
  screenshotPath?: string;
  volumeCount?: number;
  remarks?: string;
}

export interface DashboardStats {
  totalRuns: number;
  successRate: number;
  slaCompliance: number;
  avgDurationSec: number;
}

// Priority: Failed > SLABreach > LateStart > Success > None
export type CellStatus = "Success" | "Failed" | "SLABreach" | "LateStart" | "None";

export interface MatrixCell {
  dayIndex: number;       // 1-based offset from range start
  dateLabel: string;      // display label, e.g. "1", "Apr 1"
  status: CellStatus;
  runCount: number;
  transactionId?: string;
  errorMessage?: string | null;
  screenshotPath?: string | null;
  durationSec?: number;
  startTime?: string;     // ISO string of the representative (worst) run
  volumeCount?: number;   // total volume across all runs that day
}

export interface ProcessMatrix {
  processName: string;
  cells: MatrixCell[];
}

export interface ChartDataPoint {
  date: string;
  avgDuration: number;
  slaLimit: number;
}

// Legacy compat
export interface SummaryLogWithError {
  id: number;
  transactionId: string;
  processName: string;
  status: string;
  startTime: Date;
  endTime: Date | null;
  durationSec: number;
  volumeCount: number;
  remarks: string;
  isLateStart: boolean;
  isSLABreach: boolean;
  createdAt: Date;
  errorDetail: {
    id: number;
    transactionId: string;
    errorMessage: string;
    screenshotPath: string;
  } | null;
}
