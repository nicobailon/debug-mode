import { init } from "./commands/init.js";
import { cleanup } from "./commands/cleanup.js";
import { codex } from "./commands/codex.js";
import { status } from "./commands/status.js";
import { diff } from "./commands/diff.js";
import { apply } from "./commands/apply.js";

function showHelp(): void {
  console.log(`debug-mode - Hypothesis-driven debugging with dual-track parallel execution

Usage: debug-mode <command> [options]

Commands:
  init <project-root>                        Initialize worktrees and progress docs
  cleanup <project-root>                     Complete cleanup of all artifacts
  codex run <track> <iteration> <prompt>     Run a Codex iteration for a track
  codex poll <track>                         Check Codex session status for a track
  status <track>                             Check progress doc for signals
  diff <track>                               Show changes in a track's worktree
  apply <track> <project-root>               Apply a track's fix to the project

Tracks: track-a, track-b

Examples:
  debug-mode init /path/to/project
  debug-mode codex run track-a 2 /tmp/debug-track-a-prompt.md
  debug-mode codex run track-b 1 /tmp/debug-track-b-prompt.md
  debug-mode codex poll track-b
  debug-mode status track-a
  debug-mode diff track-a
  debug-mode apply track-b /path/to/project
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
    case "diff":
      await diff(args);
      break;
    case "apply":
      await apply(args);
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
