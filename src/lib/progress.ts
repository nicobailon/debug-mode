import { readFile, writeFile } from "fs/promises";
import { PATHS, type ProgressStatusResult } from "./types.js";

export function getProgressDocPath(track: "track-a" | "track-b"): string {
  return track === "track-a" ? PATHS.TRACK_A_PROGRESS : PATHS.TRACK_B_PROGRESS;
}

export async function createProgressDoc(
  track: "track-a" | "track-b",
  bugDescription: string,
  reproductionCommand: string,
  hypotheses: string[]
): Promise<void> {
  const worktree =
    track === "track-a" ? PATHS.TRACK_A_WORKTREE : PATHS.TRACK_B_WORKTREE;
  const model = track === "track-a" ? "Claude" : "GPT 5.2";

  const content = `# Debug Track ${track === "track-a" ? "A" : "B"} Progress (${model})

## Worktree
${worktree}

## Bug Description
${bugDescription}

## Reproduction Command
${reproductionCommand}

## Hypotheses
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")}

---
`;

  await writeFile(getProgressDocPath(track), content);
}

export async function readProgressDoc(track: "track-a" | "track-b"): Promise<string> {
  try {
    return await readFile(getProgressDocPath(track), "utf-8");
  } catch {
    return "";
  }
}

export async function parseProgressStatus(
  track: "track-a" | "track-b"
): Promise<ProgressStatusResult> {
  const content = await readProgressDoc(track);

  const iterationMatches = content.match(/## Iteration \d+/g);
  const iterationCount = iterationMatches ? iterationMatches.length : 0;

  const readyForFixMatches = Array.from(
    content.matchAll(/READY FOR FIX:\s*(.*?)(?:\n|$)/gi)
  );
  const earlyExitMatches = Array.from(
    content.matchAll(/EARLY EXIT:\s*(.*?)(?:\n|$)/gi)
  );

  const lastReady = readyForFixMatches.at(-1);
  const lastEarly = earlyExitMatches.at(-1);

  if (lastReady && lastEarly) {
    const readyIndex = lastReady.index ?? -1;
    const earlyIndex = lastEarly.index ?? -1;
    if (readyIndex > earlyIndex) {
      return {
        track,
        signal: "READY_FOR_FIX",
        rootCause: (lastReady[1] ?? "").trim(),
        iterationCount,
      };
    }
    return {
      track,
      signal: "EARLY_EXIT",
      reason: (lastEarly[1] ?? "").trim(),
      iterationCount,
    };
  }

  if (lastReady) {
    return {
      track,
      signal: "READY_FOR_FIX",
      rootCause: (lastReady[1] ?? "").trim(),
      iterationCount,
    };
  }

  if (lastEarly) {
    return {
      track,
      signal: "EARLY_EXIT",
      reason: (lastEarly[1] ?? "").trim(),
      iterationCount,
    };
  }

  return {
    track,
    signal: "CONTINUE",
    iterationCount,
  };
}
