# Debug Mode

Hypothesis-driven debugging with hybrid dual-track parallel execution (Opus 4.5 + GPT 5.2).

When standard debugging fails, Debug Mode spawns two independent AI tracks that work in parallel - each reviewing and improving upon its own previous work. The main agent then synthesizes findings from both tracks for high-confidence fixes.

Inspired by [Cursor's Debug Mode](https://cursor.com/blog/debug-mode).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [tmux](https://github.com/tmux/tmux) terminal multiplexer
- [Codex CLI](https://github.com/openai/codex) for GPT 5.2 track (uses OAuth login, free with ChatGPT Pro)
- [repomix](https://github.com/yamadashy/repomix) for context bundling (`npx repomix`)

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

Parses the progress document for signals (CONTINUE, SKIP_TO_VERIFY, READY_FOR_FIX, NEEDS_MORE_WORK).

### Cleanup after debugging

```bash
debug-mode cleanup /path/to/project
```

Removes worktrees, **archives branches** (for post-mortem analysis), deletes temporary files, and scans for remaining `[DEBUG_AGENT]` lines.

Branches are renamed to `archive/debug-track-{a|b}-{timestamp}` instead of being deleted, allowing you to inspect failed debugging attempts if needed.

## Architecture

```
Main Agent (coordinates orchestrators)
    |
    +-- Task() -> Track 0 Orchestrator (Opus, synchronous)
    |       +-- debug-mode context run (GPT 5.2 medium)
    |       +-- Task(model="opus") -> Repro Assessment
    |
    +-- [After Track 0 completes]
        |
        +-- Task(background) -> Track A Orchestrator (Opus)
        |   +-- A1 (Opus) -> A2 (Opus/resume) -> A3 (Opus/resume) -> A4 (GPT/verify)
        |
        +-- Task(background) -> Track B Orchestrator (Opus)
            +-- B1 (GPT) -> B2 (Opus) -> B3 (GPT) -> B4 (Opus/verify)
```

Models: **Opus 4.5** (all Claude) + **GPT 5.2** (all OpenAI)

- **Track A**: Opus -> Opus (resume) -> Opus (resume) -> GPT (chained for token savings)
- **Track B**: GPT -> Opus -> GPT -> Opus (true alternation: 2x each)

"Fresh eyes" = different MODEL reviewing previous work, not just a new instance.

Each iteration follows: **Hypothesize -> Instrument -> Reproduce -> Analyze**

Flow:
1. Track 0 Orchestrator runs Context Builder (GPT) then Repro Assessment (Opus)
2. Context Builder searches codebase, bundles with repomix into `/tmp/debug-context.md`
3. Repro Assessment establishes reproduction strategy (AUTO/SEMI_AUTO/MANUAL)
4. A1 (Opus) / B1 (GPT) generate hypotheses and attempt initial fix
5. A2/A3 and B2/B3 can fix + verify; if verified, signal `READY_FOR_FIX` and exit early
6. A4 (GPT) / B4 (Opus) final verification only if not verified earlier
7. Main agent synthesizes findings from both tracks

## Context Builder

The Context Builder (Track 0, Step 1) uses a 3-phase workflow:

1. **SEARCH** - Use Grep/Glob to identify files relevant to the bug
2. **BUNDLE** - Package files with repomix:
   ```bash
   npx repomix --include "src/auth.ts,src/utils/*.ts" --output /tmp/debug-context.md
   ```
3. **APPEND** - Add analysis summary with reproduction hints and investigation areas

The bundled context file provides all subsequent subagents with full file contents and line numbers.

## Repro Modes

Track 0 Repro Assessment (Opus sub-subagent) determines how the bug can be reproduced:

| Mode | Description |
|------|-------------|
| `AUTO` | Script-triggered (e.g., `npm test`, `./debug-repro.sh`). Exits non-zero on failure. |
| `SEMI_AUTO` | Browser-based. Uses chrome-devtools-testing skill for automation. |
| `MANUAL` | User-triggered. Documents steps for manual reproduction. |

## Signals

Subagents communicate status via signals in the progress document:

| Signal | Meaning |
|--------|---------|
| `CONTINUE` | Fix failed or incomplete, continue iterating |
| `SKIP_TO_VERIFY` | Fix works, skip to final verification (iteration 4) |
| `READY_FOR_FIX` | Final verification passed, fix is ready |
| `NEEDS_MORE_WORK` | Verification failed, specific issues documented |

## File Paths

All debug artifacts are stored in `/tmp`:

| Artifact | Path |
|----------|------|
| Track A worktree | `/tmp/debug-track-a` |
| Track B worktree | `/tmp/debug-track-b` |
| Track A progress | `/tmp/debug-track-a-progress.md` |
| Track B progress | `/tmp/debug-track-b-progress.md` |
| Context file | `/tmp/debug-context.md` |
| Track prompts | `/tmp/debug-track-{a,b}-prompt.md` |

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
