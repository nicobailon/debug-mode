import { unlink, readdir } from "fs/promises";
import { removeWorktree, deleteBranch, findDebugAgentLines } from "../lib/git.js";
import { killSession } from "../lib/tmux.js";
import { PATHS, getLogFile, getOutputFile, type CleanupResult } from "../lib/types.js";

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
    branchesDeleted: [],
    tempFilesDeleted: [],
    debugAgentLines: [],
  };

  try {
    console.error("Killing tmux session...");
    result.tmuxKilled = await killSession();

    console.error("Removing worktrees...");
    if (await removeWorktree(PATHS.TRACK_A_WORKTREE, projectRoot)) {
      result.worktreesRemoved.push(PATHS.TRACK_A_WORKTREE);
    }
    if (await removeWorktree(PATHS.TRACK_B_WORKTREE, projectRoot)) {
      result.worktreesRemoved.push(PATHS.TRACK_B_WORKTREE);
    }

    console.error("Deleting branches...");
    if (await deleteBranch("debug-track-a", projectRoot)) {
      result.branchesDeleted.push("debug-track-a");
    }
    if (await deleteBranch("debug-track-b", projectRoot)) {
      result.branchesDeleted.push("debug-track-b");
    }

    console.error("Deleting temporary files...");
    const tempFiles: string[] = [
      PATHS.TRACK_A_PROGRESS,
      PATHS.TRACK_B_PROGRESS,
      PATHS.TRACK_B_PROMPT,
      PATHS.TRACK_B_STATUS,
      PATHS.TRACK_B_RUNNER,
    ];

    try {
      const entries = await readdir("/tmp");
      for (const entry of entries) {
        if (/^debug-track-b-iter\d+\.log$/.test(entry)) {
          tempFiles.push(`/tmp/${entry}`);
        }
        if (/^debug-track-b-iter\d+-out\.txt$/.test(entry)) {
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
