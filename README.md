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
debug-mode codex run track-b 1 /tmp/debug-track-b-prompt.md
```

Launches a Codex exec session in tmux for the specified track and iteration.

### Poll Codex status

```bash
debug-mode codex poll track-b
```

Checks if the Codex session is still running for a track.

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

Removes worktrees, **archives branches** (for post-mortem analysis), deletes temporary files, and scans for remaining `[DEBUG_AGENT]` lines.

Branches are renamed to `archive/debug-track-{a|b}-{timestamp}` instead of being deleted, allowing you to inspect failed debugging attempts if needed.

## Architecture

```
Main Agent (minimal - passes bug description)
    |
    +-- Track 0 (Sequential)
    |   +-- Step 1: Context Builder (GPT 5.2 medium) - searches codebase
    |   +-- Step 2: Repro Assessment (Claude) - establishes reproduction
    |
    +-- [After Track 0 completes]
        |
        +-- Track A Orchestrator (Claude background)
        |   +-- A1 (Claude) -> A2 (GPT) -> A3 (Claude) -> A4 (Claude/verify)
        |
        +-- Track B Orchestrator (Claude background)
            +-- B1 (GPT) -> B2 (Claude) -> B3 (GPT) -> B4 (GPT/verify)
```

Models alternate within each track:
- **Track A**: Claude -> GPT -> Claude -> Claude (verify)
- **Track B**: GPT -> Claude -> GPT -> GPT (verify)

"Fresh eyes" = different MODEL reviewing previous work, not just a new instance.

Each iteration follows: **Hypothesize -> Instrument -> Reproduce -> Analyze**

Flow:
1. Context Builder (GPT medium) searches codebase, outputs `/tmp/debug-context.md`
2. Repro Assessment establishes reproduction strategy (AUTO/SEMI_AUTO/MANUAL)
3. A1 (Claude) / B1 (GPT) generate hypotheses and attempt initial fix
4. A2 (GPT) / B2 (Claude) review - if good, signal `SKIP_TO_VERIFY`
5. A4 / B4 perform final verification
6. Main agent synthesizes findings from both tracks

## CLI Commands

| Command | Description |
|---------|-------------|
| `debug-mode init <project>` | Initialize worktrees and progress docs |
| `debug-mode cleanup <project>` | Complete cleanup of all artifacts |
| `debug-mode context run <prompt> <project>` | Launch context builder (GPT 5.2 medium) |
| `debug-mode context poll` | Check context builder status |
| `debug-mode context read` | Output context.md contents |
| `debug-mode codex run <track> <n> <prompt>` | Run Codex iteration N for a track |
| `debug-mode codex poll <track>` | Check Codex session status for a track |
| `debug-mode status <track>` | Check progress doc for signals |
| `debug-mode diff <track>` | Show changes in a track's worktree |
| `debug-mode apply <track> <project>` | Apply a track's fix to the project |

Tracks: `track-a`, `track-b`

## Development

```bash
bun install          # Install dependencies
bun x tsx src/cli.ts # Run directly
```

## License

MIT
