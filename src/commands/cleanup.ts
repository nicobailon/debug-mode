import { unlink, readdir } from "fs/promises";
import { removeWorktree, archiveBranch, findDebugAgentLines } from "../lib/git.js";
import { killAllSessions } from "../lib/tmux.js";
import { PATHS, getTrackPaths, type CleanupResult } from "../lib/types.js";

async function deleteFile(path: string): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

export async function cleanup(args: string[]): Promise<void> {
  const projectRoot = args[0] || process.cwd();

  const result: CleanupResult = {
    tmuxKilled: false,
    worktreesRemoved: [],
    branchesArchived: [],
    tempFilesDeleted: [],
    debugAgentLines: [],
  };

  try {
    console.error("Killing tmux sessions...");
    result.tmuxKilled = await killAllSessions();

    console.error("Removing worktrees...");
    if (await removeWorktree(PATHS.TRACK_A_WORKTREE, projectRoot)) {
      result.worktreesRemoved.push(PATHS.TRACK_A_WORKTREE);
    }
    if (await removeWorktree(PATHS.TRACK_B_WORKTREE, projectRoot)) {
      result.worktreesRemoved.push(PATHS.TRACK_B_WORKTREE);
    }

    console.error("Archiving branches...");
    const archivedA = await archiveBranch("debug-track-a", projectRoot);
    if (archivedA) {
      result.branchesArchived.push(archivedA);
    }
    const archivedB = await archiveBranch("debug-track-b", projectRoot);
    if (archivedB) {
      result.branchesArchived.push(archivedB);
    }

    console.error("Deleting temporary files...");
    const trackAPaths = getTrackPaths("track-a");
    const trackBPaths = getTrackPaths("track-b");

    const tempFiles: string[] = [
      PATHS.TRACK_A_PROGRESS,
      PATHS.TRACK_B_PROGRESS,
      PATHS.CONTEXT_FILE,
      PATHS.CONTEXT_PROMPT,
      PATHS.CONTEXT_STATUS,
      PATHS.CONTEXT_LOG,
      PATHS.CONTEXT_OUTPUT,
      PATHS.CONTEXT_RUNNER,
      trackAPaths.prompt,
      trackAPaths.status,
      trackAPaths.runner,
      trackBPaths.prompt,
      trackBPaths.status,
      trackBPaths.runner,
    ];

    try {
      const entries = await readdir("/tmp");
      for (const entry of entries) {
        if (/^debug-track-[ab]-iter\d+\.log$/.test(entry)) {
          tempFiles.push(`/tmp/${entry}`);
        }
        if (/^debug-track-[ab]-iter\d+-out\.txt$/.test(entry)) {
          tempFiles.push(`/tmp/${entry}`);
        }
      }
    } catch {
      // ignore inability to scan /tmp
    }

    for (const file of tempFiles) {
      if (await deleteFile(file)) {
        result.tempFilesDeleted.push(file);
      }
    }

    console.error("Scanning for remaining [DEBUG_AGENT] lines...");
    result.debugAgentLines = await findDebugAgentLines(projectRoot);

    console.log(JSON.stringify(result, null, 2));

    if (result.debugAgentLines.length > 0) {
      console.error("");
      console.error("WARNING: Found [DEBUG_AGENT] lines that need manual removal:");
      for (const line of result.debugAgentLines) {
        console.error(`  ${line}`);
      }
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}
