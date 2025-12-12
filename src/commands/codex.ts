import { killSession, launchCodex, pollStatus } from "../lib/tmux.js";
import { getTrackPaths, getLogFile, getOutputFile, isValidTrack, type CodexRunResult } from "../lib/types.js";

export async function codex(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "run":
      await codexRun(args.slice(1));
      break;
    case "poll":
      await codexPoll(args.slice(1));
      break;
    default:
      console.error("Usage: debug-mode codex <run|poll> <track> [options]");
      console.error("");
      console.error("Subcommands:");
      console.error("  run <track> <iteration> <prompt-file>  Run a Codex iteration");
      console.error("  poll <track>                           Check Codex session status");
      console.error("");
      console.error("Tracks: track-a, track-b");
      process.exit(1);
  }
}

async function codexRun(args: string[]): Promise<void> {
  const track = args[0];
  const iterationStr = args[1];
  const promptFile = args[2];

  if (!track || !isValidTrack(track)) {
    console.error("Usage: debug-mode codex run <track> <iteration> <prompt-file>");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode codex run track-a 2 /tmp/debug-track-a-prompt.md");
    console.error("  debug-mode codex run track-b 1 /tmp/debug-track-b-prompt.md");
    process.exit(1);
  }

  if (!iterationStr || !promptFile) {
    console.error("Usage: debug-mode codex run <track> <iteration> <prompt-file>");
    process.exit(1);
  }

  const iteration = parseInt(iterationStr, 10);
  if (isNaN(iteration) || iteration < 1) {
    console.error("Error: iteration must be a positive integer");
    process.exit(1);
  }

  try {
    console.error(`Killing any existing ${track} session...`);
    await killSession(track);

    console.error(`Launching Codex ${track} iteration ${iteration}...`);
    await launchCodex(track, iteration, promptFile);

    const paths = getTrackPaths(track);
    const result: CodexRunResult = {
      session: paths.tmuxSession,
      iteration,
      logFile: getLogFile(track, iteration),
      outputFile: getOutputFile(track, iteration),
      statusFile: paths.status,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error launching Codex:", error);
    process.exit(1);
  }
}

async function codexPoll(args: string[]): Promise<void> {
  const track = args[0];

  if (!track || !isValidTrack(track)) {
    console.error("Usage: debug-mode codex poll <track>");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode codex poll track-a");
    console.error("  debug-mode codex poll track-b");
    process.exit(1);
  }

  try {
    const result = await pollStatus(track);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error polling Codex status:", error);
    process.exit(1);
  }
}
