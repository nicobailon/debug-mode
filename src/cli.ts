import { init } from "./commands/init.js";
import { cleanup } from "./commands/cleanup.js";
import { codex } from "./commands/codex.js";
import { status } from "./commands/status.js";

function showHelp(): void {
  console.log(`debug-mode - Hypothesis-driven debugging with dual-track parallel execution

Usage: debug-mode <command> [options]

Commands:
  init <project-root>              Initialize worktrees and progress docs
  cleanup <project-root>           Complete cleanup of all artifacts
  codex run <iteration> <prompt>   Run a Codex iteration
  codex poll                       Check Codex session status
  status <track-a|track-b>         Check progress doc for signals

Examples:
  debug-mode init /path/to/project
  debug-mode codex run 1 /tmp/track-b-prompt.md
  debug-mode codex poll
  debug-mode status track-a
  debug-mode cleanup /path/to/project
`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "init":
      await init(args);
      break;
    case "cleanup":
      await cleanup(args);
      break;
    case "codex":
      await codex(args);
      break;
    case "status":
      await status(args);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    case undefined:
      showHelp();
      process.exit(1);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("");
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
