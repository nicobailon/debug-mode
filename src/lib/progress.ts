import { readFile, writeFile } from "fs/promises";
import { PATHS, type Track, type ProgressStatusResult } from "./types.js";

export function getProgressDocPath(track: Track): string {
  return track === "track-a" ? PATHS.TRACK_A_PROGRESS : PATHS.TRACK_B_PROGRESS;
}

export async function createProgressDoc(
  track: Track,
  bugDescription: string
): Promise<void> {
  const worktree =
    track === "track-a" ? PATHS.TRACK_A_WORKTREE : PATHS.TRACK_B_WORKTREE;
  const trackLetter = track === "track-a" ? "A" : "B";

  const content = `# Debug Track ${trackLetter} Progress

## Worktree
${worktree}

## Bug Description
${bugDescription}

## Context
See: ${PATHS.CONTEXT_FILE}

## Track 0 - Repro Assessment
(To be filled by Track 0 repro subagent)

REPRO_MODE: pending
REPRO_COMMAND: pending
REPRO_SCRIPT: pending

---
`;

  await writeFile(getProgressDocPath(track), content);
}

export async function readProgressDoc(track: Track): Promise<string> {
  try {
    return await readFile(getProgressDocPath(track), "utf-8");
  } catch {
    return "";
  }
}

interface SignalMatch {
  signal: ProgressStatusResult["signal"];
  index: number;
  value: string;
}

export async function parseProgressStatus(track: Track): Promise<ProgressStatusResult> {
  const content = await readProgressDoc(track);

  const iterationMatches = content.match(/## Iteration \d+/g);
  const iterationCount = iterationMatches ? iterationMatches.length : 0;

  const signals: SignalMatch[] = [];

  const skipMatches = Array.from(content.matchAll(/SKIP_TO_VERIFY:?\s*(.*?)(?:\n|$)/gi));
  for (const m of skipMatches) {
    signals.push({ signal: "SKIP_TO_VERIFY", index: m.index ?? 0, value: (m[1] ?? "").trim() });
  }

  const readyMatches = Array.from(content.matchAll(/READY[_\s]FOR[_\s]FIX:?\s*(.*?)(?:\n|$)/gi));
  for (const m of readyMatches) {
    signals.push({ signal: "READY_FOR_FIX", index: m.index ?? 0, value: (m[1] ?? "").trim() });
  }

  const needsWorkMatches = Array.from(content.matchAll(/NEEDS[_\s]MORE[_\s]WORK:?\s*(.*?)(?:\n|$)/gi));
  for (const m of needsWorkMatches) {
    signals.push({ signal: "NEEDS_MORE_WORK", index: m.index ?? 0, value: (m[1] ?? "").trim() });
  }

  const earlyExitMatches = Array.from(content.matchAll(/EARLY[_\s]EXIT:?\s*(.*?)(?:\n|$)/gi));
  for (const m of earlyExitMatches) {
    signals.push({ signal: "EARLY_EXIT", index: m.index ?? 0, value: (m[1] ?? "").trim() });
  }

  if (signals.length === 0) {
    return { track, signal: "CONTINUE", iterationCount };
  }

  const lastSignal = signals.sort((a, b) => b.index - a.index)[0];

  return {
    track,
    signal: lastSignal.signal,
    iterationCount,
    ...(lastSignal.signal === "READY_FOR_FIX"
      ? { rootCause: lastSignal.value }
      : { reason: lastSignal.value }),
  };
}
