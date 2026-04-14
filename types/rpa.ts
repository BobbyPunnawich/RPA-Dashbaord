export interface LogPayload {
  transactionId: string;
  processName: string;
  status: "Success" | "Failed";
  startTime: string; // ISO 8601
  durationSec: number;
  volumeCount?: number;
  errorMessage?: string;
  screenshotPath?: string;
}

export interface SummaryLogWithError {
  id: number;
  transactionId: string;
  processName: string;
  status: string;
  startTime: Date;
  durationSec: number;
  volumeCount: number;
  createdAt: Date;
  errorDetail: {
    id: number;
    transactionId: string;
    errorMessage: string;
    screenshotPath: string;
  } | null;
}

export interface DashboardStats {
  successRate: number;
  avgDurationSec: number;
  totalVolume: number;
  totalRuns: number;
}

export interface MatrixCell {
  day: number;
  status: "Success" | "Failed" | "None";
  transactionId?: string;
  errorMessage?: string;
  screenshotPath?: string;
  durationSec?: number;
}

export interface ProcessMatrix {
  processName: string;
  cells: MatrixCell[];
}
