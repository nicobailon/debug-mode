import { execFile } from "child_process";
import { promisify } from "util";
import { PATHS } from "./types.js";

const execFileAsync = promisify(execFile);

export async function removeWorktree(path: string, projectRoot?: string): Promise<boolean> {
  try {
    const args = projectRoot
      ? ["-C", projectRoot, "worktree", "remove", path, "--force"]
      : ["worktree", "remove", path, "--force"];
    await execFileAsync("git", args);
    return true;
  } catch {
    return false;
  }
}

export async function deleteBranch(branch: string, projectRoot?: string): Promise<boolean> {
  try {
    const args = projectRoot
      ? ["-C", projectRoot, "branch", "-D", branch]
      : ["branch", "-D", branch];
    await execFileAsync("git", args);
    return true;
  } catch {
    return false;
  }
}

export async function archiveBranch(
  branch: string,
  projectRoot: string
): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archiveName = `archive/${branch}-${timestamp}`;
  try {
    await execFileAsync("git", [
      "-C",
      projectRoot,
      "branch",
      "-m",
      branch,
      archiveName,
    ]);
    return archiveName;
  } catch {
    return null;
  }
}

export async function createWorktree(
  path: string,
  branch: string,
  projectRoot: string
): Promise<void> {
  await execFileAsync("git", [
    "-C",
    projectRoot,
    "worktree",
    "add",
    path,
    "-b",
    branch,
    "HEAD",
  ]);
}

export async function cleanupExistingWorktrees(projectRoot: string): Promise<void> {
  await removeWorktree(PATHS.TRACK_A_WORKTREE, projectRoot);
  await removeWorktree(PATHS.TRACK_B_WORKTREE, projectRoot);

  try {
    await execFileAsync("git", [
      "-C",
      projectRoot,
      "branch",
      "-D",
      "debug-track-a",
      "debug-track-b",
    ]);
  } catch {
    // ignore if branches don't exist
  }
}

export async function createDebugWorktrees(projectRoot: string): Promise<void> {
  await createWorktree(PATHS.TRACK_A_WORKTREE, "debug-track-a", projectRoot);
  await createWorktree(PATHS.TRACK_B_WORKTREE, "debug-track-b", projectRoot);
}

export async function findDebugAgentLines(projectRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("grep", [
      "-rn",
      "\\[DEBUG_AGENT\\]",
      projectRoot,
      "--include=*.js",
      "--include=*.ts",
      "--include=*.tsx",
      "--include=*.py",
      "--include=*.go",
      "--include=*.java",
    ]);
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function isGitRepo(projectRoot: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", [
      "-C",
      projectRoot,
      "rev-parse",
      "--is-inside-work-tree",
    ]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
