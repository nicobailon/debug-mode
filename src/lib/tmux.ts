import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, chmod } from "fs/promises";
import { PATHS, getLogFile, getOutputFile, type CodexPollResult } from "./types.js";

const execFileAsync = promisify(execFile);

const RUNNER_SCRIPT = `#!/usr/bin/env bash
set -u

iteration="$1"
prompt_file="$2"
worktree="$3"
output_file="$4"
log_file="$5"
status_file="$6"

prompt="$(cat -- "$prompt_file")"

if codex exec -m gpt-5.2 --full-auto \\
  -c model_reasoning_effort=xhigh \\
  -c model_reasoning_summary=detailed \\
  -C "$worktree" \\
  -o "$output_file" \\
  "$prompt" >"$log_file" 2>&1; then
  echo "DONE" >"$status_file"
else
  echo "FAILED" >"$status_file"
fi
`;

async function ensureRunnerScript(): Promise<void> {
  await writeFile(PATHS.TRACK_B_RUNNER, RUNNER_SCRIPT, { mode: 0o700 });
  await chmod(PATHS.TRACK_B_RUNNER, 0o700);
}

export async function killSession(): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["kill-session", "-t", PATHS.TMUX_SESSION]);
    return true;
  } catch {
    return false;
  }
}

export async function sessionExists(): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["has-session", "-t", PATHS.TMUX_SESSION]);
    return true;
  } catch {
    return false;
  }
}

export async function launchCodex(
  iteration: number,
  promptFile: string
): Promise<void> {
  try {
    await readFile(promptFile, "utf-8");
  } catch {
    throw new Error(`Prompt file not readable: ${promptFile}`);
  }

  await ensureRunnerScript();

  const logFile = getLogFile(iteration);
  const outputFile = getOutputFile(iteration);

  await execFileAsync("tmux", [
    "new-session",
    "-d",
    "-s",
    PATHS.TMUX_SESSION,
    PATHS.TRACK_B_RUNNER,
    String(iteration),
    promptFile,
    PATHS.TRACK_B_WORKTREE,
    outputFile,
    logFile,
    PATHS.TRACK_B_STATUS,
  ]);
}

export async function pollStatus(): Promise<CodexPollResult> {
  const running = await sessionExists();

  if (running) {
    return { status: "RUNNING" };
  }

  try {
    const status = await readFile(PATHS.TRACK_B_STATUS, "utf-8");
    const trimmed = status.trim();

    if (trimmed === "DONE") {
      return { status: "DONE" };
    } else if (trimmed === "FAILED") {
      return { status: "FAILED" };
    }
  } catch {
    // ignore missing/unreadable status file
  }

  return { status: "NOT_FOUND" };
}
