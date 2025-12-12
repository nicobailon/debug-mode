import { execFile } from "child_process";
import { promisify } from "util";
import { getTrackPaths, isValidTrack } from "../lib/types.js";

const execFileAsync = promisify(execFile);

export async function apply(args: string[]): Promise<void> {
  const track = args[0];
  const projectRoot = args[1];

  if (!track || !isValidTrack(track) || !projectRoot) {
    console.error("Usage: debug-mode apply <track> <project-root>");
    console.error("");
    console.error("Applies the fix from a track's worktree to the main project.");
    console.error("Creates a patch from the track and applies it to the project root.");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode apply track-a /path/to/project");
    console.error("  debug-mode apply track-b /path/to/project");
    process.exit(1);
  }

  const paths = getTrackPaths(track);

  try {
    console.error(`Getting diff from ${track} worktree...`);
    const { stdout: patch } = await execFileAsync("git", [
      "-C",
      paths.worktree,
      "diff",
      "HEAD",
      "--",
      ".",
    ]);

    if (!patch.trim()) {
      console.error(`No changes in ${track} worktree to apply.`);
      process.exit(1);
    }

    console.error(`Applying patch to ${projectRoot}...`);
    const applyProcess = execFile("git", [
      "-C",
      projectRoot,
      "apply",
      "--verbose",
      "-",
    ]);

    if (applyProcess.stdin) {
      applyProcess.stdin.write(patch);
      applyProcess.stdin.end();
    }

    await new Promise<void>((resolve, reject) => {
      applyProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`git apply exited with code ${code}`));
        }
      });
      applyProcess.on("error", reject);
    });

    console.log(JSON.stringify({
      success: true,
      track,
      projectRoot,
      message: `Applied ${track} fix to ${projectRoot}`,
    }, null, 2));

  } catch (error) {
    console.error(`Error applying ${track} fix:`, error);
    process.exit(1);
  }
}
