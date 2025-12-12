import { cleanupExistingWorktrees, createDebugWorktrees, isGitRepo } from "../lib/git.js";
import { createProgressDoc } from "../lib/progress.js";
import { PATHS, type InitResult } from "../lib/types.js";

export async function init(args: string[]): Promise<void> {
  const projectRoot = args[0];

  if (!projectRoot) {
    console.error("Usage: debug-mode init <project-root>");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode init /path/to/project");
    process.exit(1);
  }

  try {
    const repoOk = await isGitRepo(projectRoot);
    if (!repoOk) {
      console.error(`Error: ${projectRoot} is not a git repository`);
      process.exit(1);
    }

    console.error("Cleaning up existing worktrees...");
    await cleanupExistingWorktrees(projectRoot);

    console.error("Creating fresh worktrees...");
    await createDebugWorktrees(projectRoot);

    console.error("Creating progress documents...");
    await createProgressDoc(
      "track-a",
      "{bug_description}",
      [
        "{hypothesis_1}",
        "{hypothesis_2}",
        "{hypothesis_3}",
        "{hypothesis_4}",
        "{hypothesis_5}",
        "{hypothesis_6}",
      ]
    );
    await createProgressDoc(
      "track-b",
      "{bug_description}",
      [
        "{hypothesis_1}",
        "{hypothesis_2}",
        "{hypothesis_3}",
        "{hypothesis_4}",
        "{hypothesis_5}",
        "{hypothesis_6}",
      ]
    );

    const result: InitResult = {
      trackA: {
        worktree: PATHS.TRACK_A_WORKTREE,
        progressDoc: PATHS.TRACK_A_PROGRESS,
        branch: "debug-track-a",
      },
      trackB: {
        worktree: PATHS.TRACK_B_WORKTREE,
        progressDoc: PATHS.TRACK_B_PROGRESS,
        branch: "debug-track-b",
      },
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error initializing debug session:", error);
    process.exit(1);
  }
}
