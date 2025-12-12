import { killSession, launchCodex, pollStatus } from "../lib/tmux.js";
import { PATHS, getLogFile, getOutputFile, type CodexRunResult } from "../lib/types.js";

export async function codex(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "run":
      await codexRun(args.slice(1));
      break;
    case "poll":
      await codexPoll();
      break;
    default:
      console.error("Usage: debug-mode codex <run|poll>");
      console.error("");
      console.error("Subcommands:");
      console.error("  run <iteration> <prompt-file>  Run a Codex iteration");
      console.error("  poll                           Check Codex session status");
      process.exit(1);
  }
}

async function codexRun(args: string[]): Promise<void> {
  const iterationStr = args[0];
  const promptFile = args[1];

  if (!iterationStr || !promptFile) {
    console.error("Usage: debug-mode codex run <iteration> <prompt-file>");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode codex run 1 /tmp/track-b-prompt.md");
    process.exit(1);
  }

  const iteration = parseInt(iterationStr, 10);
  if (isNaN(iteration) || iteration < 1) {
    console.error("Error: iteration must be a positive integer");
    process.exit(1);
  }

  try {
    console.error("Killing any existing session...");
    await killSession();

    console.error(`Launching Codex iteration ${iteration}...`);
    await launchCodex(iteration, promptFile);

    const result: CodexRunResult = {
      session: PATHS.TMUX_SESSION,
      iteration,
      logFile: getLogFile(iteration),
      outputFile: getOutputFile(iteration),
      statusFile: PATHS.TRACK_B_STATUS,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error launching Codex:", error);
    process.exit(1);
  }
}

async function codexPoll(): Promise<void> {
  try {
    const result = await pollStatus();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error polling Codex status:", error);
    process.exit(1);
  }
}
