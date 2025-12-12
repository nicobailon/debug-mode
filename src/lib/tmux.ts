import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, chmod } from "fs/promises";
import { PATHS, getTrackPaths, getLogFile, getOutputFile, type Track, type CodexPollResult } from "./types.js";

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

const CONTEXT_BUILDER_SCRIPT = `#!/usr/bin/env bash
set -u

prompt_file="$1"
project_root="$2"
output_file="$3"
log_file="$4"
status_file="$5"

prompt="$(cat -- "$prompt_file")"

if codex exec -m gpt-5.2 --full-auto \\
  -c model_reasoning_effort=medium \\
  -c model_reasoning_summary=detailed \\
  -C "$project_root" \\
  -o "$output_file" \\
  "$prompt" >"$log_file" 2>&1; then
  echo "DONE" >"$status_file"
else
  echo "FAILED" >"$status_file"
fi
`;

async function ensureRunnerScript(track: Track): Promise<void> {
  const paths = getTrackPaths(track);
  await writeFile(paths.runner, RUNNER_SCRIPT, { mode: 0o700 });
  await chmod(paths.runner, 0o700);
}

export async function killSession(track: Track): Promise<boolean> {
  const paths = getTrackPaths(track);
  try {
    await execFileAsync("tmux", ["kill-session", "-t", paths.tmuxSession]);
    return true;
  } catch {
    return false;
  }
}

export async function killContextSession(): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["kill-session", "-t", PATHS.CONTEXT_SESSION]);
    return true;
  } catch {
    return false;
  }
}

export async function killAllSessions(): Promise<boolean> {
  const killedContext = await killContextSession();
  const killedA = await killSession("track-a");
  const killedB = await killSession("track-b");
  return killedContext || killedA || killedB;
}

export async function sessionExists(track: Track): Promise<boolean> {
  const paths = getTrackPaths(track);
  try {
    await execFileAsync("tmux", ["has-session", "-t", paths.tmuxSession]);
    return true;
  } catch {
    return false;
  }
}

export async function launchCodex(
  track: Track,
  iteration: number,
  promptFile: string
): Promise<void> {
  try {
    await readFile(promptFile, "utf-8");
  } catch {
    throw new Error(`Prompt file not readable: ${promptFile}`);
  }

  const paths = getTrackPaths(track);
  await ensureRunnerScript(track);

  const logFile = getLogFile(track, iteration);
  const outputFile = getOutputFile(track, iteration);

  await execFileAsync("tmux", [
    "new-session",
    "-d",
    "-s",
    paths.tmuxSession,
    paths.runner,
    String(iteration),
    promptFile,
    paths.worktree,
    outputFile,
    logFile,
    paths.status,
  ]);
}

export async function pollStatus(track: Track): Promise<CodexPollResult> {
  const paths = getTrackPaths(track);
  const running = await sessionExists(track);

  if (running) {
    return { status: "RUNNING" };
  }

  try {
    const status = await readFile(paths.status, "utf-8");
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

async function ensureContextRunnerScript(): Promise<void> {
  await writeFile(PATHS.CONTEXT_RUNNER, CONTEXT_BUILDER_SCRIPT, { mode: 0o700 });
  await chmod(PATHS.CONTEXT_RUNNER, 0o700);
}

async function contextSessionExists(): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["has-session", "-t", PATHS.CONTEXT_SESSION]);
    return true;
  } catch {
    return false;
  }
}

export async function launchContextBuilder(
  promptFile: string,
  projectRoot: string
): Promise<void> {
  try {
    await readFile(promptFile, "utf-8");
  } catch {
    throw new Error(`Prompt file not readable: ${promptFile}`);
  }

  await ensureContextRunnerScript();

  await execFileAsync("tmux", [
    "new-session",
    "-d",
    "-s",
    PATHS.CONTEXT_SESSION,
    PATHS.CONTEXT_RUNNER,
    promptFile,
    projectRoot,
    PATHS.CONTEXT_OUTPUT,
    PATHS.CONTEXT_LOG,
    PATHS.CONTEXT_STATUS,
  ]);
}

export async function pollContextBuilder(): Promise<CodexPollResult> {
  const running = await contextSessionExists();

  if (running) {
    return { status: "RUNNING" };
  }

  try {
    const status = await readFile(PATHS.CONTEXT_STATUS, "utf-8");
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
