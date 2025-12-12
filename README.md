# Debug Mode

Hypothesis-driven debugging with hybrid dual-track parallel execution (Claude + GPT 5.2).

When standard debugging fails, Debug Mode spawns two independent AI tracks that work in parallel - each reviewing and improving upon its own previous work. The main agent then synthesizes findings from both tracks for high-confidence fixes.

Inspired by [Cursor's Debug Mode](https://cursor.com/blog/debug-mode).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [tmux](https://github.com/tmux/tmux) terminal multiplexer
- [Codex CLI](https://github.com/openai/codex) for GPT 5.2 track (uses OAuth login, free with ChatGPT Pro)

### Installation

```bash
cd ~/.claude/skills/debug-mode
bun install

# Add to PATH (optional but recommended)
mkdir -p ~/agent-tools/bin
ln -s ~/.claude/skills/debug-mode/bin/debug-mode ~/agent-tools/bin/
```

## Usage

### Initialize a debug session

```bash
debug-mode init /path/to/project
```

Creates isolated git worktrees and progress documents for both tracks.

### Run a Codex iteration

```bash
debug-mode codex run 1 /tmp/track-b-prompt.md
```

Launches a Codex exec session in tmux for the specified iteration.

### Poll Codex status

```bash
debug-mode codex poll
```

Checks if the Codex session is still running.

### Check track progress

```bash
debug-mode status track-a
debug-mode status track-b
```

Parses the progress document and checks for READY_FOR_FIX or EARLY_EXIT signals.

### Cleanup after debugging

```bash
debug-mode cleanup /path/to/project
```

Removes worktrees, kills tmux sessions, deletes temporary files, and scans for remaining `[DEBUG_AGENT]` lines.

## Architecture

```
Main Agent
    |
    +-- Track A Orchestrator (background subagent)
    |   +-- Spawns sub-subagents A1 -> A2 -> A3 ... (Claude)
    |       Each reviews previous work via progress doc
    |
    +-- Track B Orchestrator (background subagent)
        +-- Runs codex exec B1 -> B2 -> B3 ... (GPT 5.2)
            Each reviews previous work via progress doc
```

Two parallel debugging tracks:
- **Track A**: Claude subagents review each other's work
- **Track B**: GPT 5.2 (via Codex CLI) reviews each other's work

Each track maintains a progress document for continuity between iterations.
The main agent synthesizes findings from both tracks for a high-confidence fix.

## CLI Commands

| Command | Description |
|---------|-------------|
| `debug-mode init <project>` | Initialize worktrees and progress docs |
| `debug-mode cleanup <project>` | Complete cleanup of all artifacts |
| `debug-mode codex run <n> <prompt>` | Run Codex iteration N |
| `debug-mode codex poll` | Check Codex session status |
| `debug-mode status <track>` | Check progress doc for signals |

## Development

```bash
bun install          # Install dependencies
bun x tsx src/cli.ts # Run directly
```

## License

MIT
