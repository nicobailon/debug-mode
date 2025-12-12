import { execFile } from "child_process";
import { promisify } from "util";
import { getTrackPaths, isValidTrack } from "../lib/types.js";

const execFileAsync = promisify(execFile);

export async function diff(args: string[]): Promise<void> {
  const track = args[0];

  if (!track || !isValidTrack(track)) {
    console.error("Usage: debug-mode diff <track>");
    console.error("");
    console.error("Shows all changes made in a track's worktree.");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode diff track-a");
    console.error("  debug-mode diff track-b");
    process.exit(1);
  }

  const paths = getTrackPaths(track);

  try {
    const { stdout } = await execFileAsync("git", [
      "-C",
      paths.worktree,
      "diff",
      "HEAD",
      "--",
      ".",
    ]);

    if (stdout.trim()) {
      console.log(stdout);
    } else {
      console.error(`No changes in ${track} worktree.`);
    }
  } catch (error) {
    console.error(`Error getting diff for ${track}:`, error);
    process.exit(1);
  }
}
