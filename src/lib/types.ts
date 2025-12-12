export interface InitResult {
  trackA: {
    worktree: string;
    progressDoc: string;
    branch: string;
  };
  trackB: {
    worktree: string;
    progressDoc: string;
    branch: string;
  };
}

export interface CleanupResult {
  tmuxKilled: boolean;
  worktreesRemoved: string[];
  branchesDeleted: string[];
  tempFilesDeleted: string[];
  debugAgentLines: string[];
}

export interface CodexRunResult {
  session: string;
  iteration: number;
  logFile: string;
  outputFile: string;
  statusFile: string;
}

export interface CodexPollResult {
  status: "RUNNING" | "DONE" | "FAILED" | "NOT_FOUND";
}

export interface ProgressStatusResult {
  track: "track-a" | "track-b";
  signal: "CONTINUE" | "READY_FOR_FIX" | "EARLY_EXIT";
  rootCause?: string;
  reason?: string;
  iterationCount: number;
}

export const PATHS = {
  TRACK_A_WORKTREE: "/tmp/debug-track-a",
  TRACK_B_WORKTREE: "/tmp/debug-track-b",
  TRACK_A_PROGRESS: "/tmp/debug-track-a-progress.md",
  TRACK_B_PROGRESS: "/tmp/debug-track-b-progress.md",
  TRACK_B_PROMPT: "/tmp/track-b-prompt.md",
  TRACK_B_STATUS: "/tmp/debug-track-b.status",
  TRACK_B_RUNNER: "/tmp/debug-track-b-runner.sh",
  TMUX_SESSION: "debug-track-b",
} as const;

export function getLogFile(iteration: number): string {
  return `/tmp/debug-track-b-iter${iteration}.log`;
}

export function getOutputFile(iteration: number): string {
  return `/tmp/debug-track-b-iter${iteration}-out.txt`;
}
