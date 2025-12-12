import { readFile } from "fs/promises";
import { killContextSession, launchContextBuilder, pollContextBuilder } from "../lib/tmux.js";
import { PATHS, type ContextRunResult } from "../lib/types.js";

export async function context(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "run":
      await contextRun(args.slice(1));
      break;
    case "poll":
      await contextPoll();
      break;
    case "read":
      await contextRead();
      break;
    default:
      console.error("Usage: debug-mode context <run|poll|read>");
      console.error("");
      console.error("Subcommands:");
      console.error("  run <prompt-file> <project-root>  Launch context builder");
      console.error("  poll                              Check context builder status");
      console.error("  read                              Output context.md contents");
      process.exit(1);
  }
}

async function contextRun(args: string[]): Promise<void> {
  const promptFile = args[0];
  const projectRoot = args[1];

  if (!promptFile || !projectRoot) {
    console.error("Usage: debug-mode context run <prompt-file> <project-root>");
    console.error("");
    console.error("Example:");
    console.error("  debug-mode context run /tmp/debug-context-prompt.md /path/to/project");
    process.exit(1);
  }

  try {
    console.error("Killing any existing context builder session...");
    await killContextSession();

    console.error("Launching context builder...");
    await launchContextBuilder(promptFile, projectRoot);

    const result: ContextRunResult = {
      session: PATHS.CONTEXT_SESSION,
      logFile: PATHS.CONTEXT_LOG,
      outputFile: PATHS.CONTEXT_OUTPUT,
      statusFile: PATHS.CONTEXT_STATUS,
      contextFile: PATHS.CONTEXT_FILE,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error launching context builder:", error);
    process.exit(1);
  }
}

async function contextPoll(): Promise<void> {
  try {
    const result = await pollContextBuilder();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error polling context builder status:", error);
    process.exit(1);
  }
}

async function contextRead(): Promise<void> {
  try {
    const content = await readFile(PATHS.CONTEXT_FILE, "utf-8");
    console.log(content);
  } catch {
    console.error(`Context file not found: ${PATHS.CONTEXT_FILE}`);
    process.exit(1);
  }
}
