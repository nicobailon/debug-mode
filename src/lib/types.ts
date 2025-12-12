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
  branchesArchived: string[];
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

export type Track = "track-a" | "track-b";

export function isValidTrack(track: string): track is Track {
  return track === "track-a" || track === "track-b";
}

export interface ProgressStatusResult {
  track: Track;
  signal: "CONTINUE" | "SKIP_TO_VERIFY" | "READY_FOR_FIX" | "NEEDS_MORE_WORK" | "EARLY_EXIT";
  rootCause?: string;
  reason?: string;
  iterationCount: number;
}

export const PATHS = {
  TRACK_A_WORKTREE: "/tmp/debug-track-a",
  TRACK_B_WORKTREE: "/tmp/debug-track-b",
  TRACK_A_PROGRESS: "/tmp/debug-track-a-progress.md",
  TRACK_B_PROGRESS: "/tmp/debug-track-b-progress.md",
} as const;

export function getTrackPaths(track: Track) {
  const prefix = track === "track-a" ? "debug-track-a" : "debug-track-b";
  return {
    worktree: track === "track-a" ? PATHS.TRACK_A_WORKTREE : PATHS.TRACK_B_WORKTREE,
    progress: track === "track-a" ? PATHS.TRACK_A_PROGRESS : PATHS.TRACK_B_PROGRESS,
    prompt: `/tmp/${prefix}-prompt.md`,
    status: `/tmp/${prefix}.status`,
    runner: `/tmp/${prefix}-runner.sh`,
    tmuxSession: `${prefix}-codex`,
  };
}

export function getLogFile(track: Track, iteration: number): string {
  const prefix = track === "track-a" ? "debug-track-a" : "debug-track-b";
  return `/tmp/${prefix}-iter${iteration}.log`;
}

export function getOutputFile(track: Track, iteration: number): string {
  const prefix = track === "track-a" ? "debug-track-a" : "debug-track-b";
  return `/tmp/${prefix}-iter${iteration}-out.txt`;
}
