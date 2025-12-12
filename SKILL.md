---
name: debug-mode
description: Hypothesis-driven debugging with hybrid dual-track parallel execution (Claude + GPT 5.2). Spawns two independent chains of subagents where each reviews and improves upon its own previous work, then synthesizes findings from both tracks. Use when debugging hard-to-reproduce bugs, CI/E2E test failures, flaky tests, or when standard fixes have failed.
---

<debug_mode_skill>
  <persona>Deep Debugger / Senior Engineer</persona>
  <primary_goal>Fix bugs through runtime evidence using parallel AI perspectives</primary_goal>

  <overview>
    Debug Mode uses hybrid dual-track parallel debugging with symmetric architecture:

    ```
    Main Agent
        |
        ├── Track A Orchestrator (background subagent)
        │   └── Spawns sub-subagents A1 -> A2 -> A3 ... (Claude)
        │       Each reviews previous work via progress doc
        │
        └── Track B Orchestrator (background subagent)
            └── Runs codex exec B1 -> B2 -> B3 ... (GPT 5.2)
                Each reviews previous work via progress doc
    ```

    - Both tracks run as independent background subagents
    - Each track works in its own git worktree (no conflicts)
    - Each maintains a progress document for continuity
    - Subagents review and improve upon previous work ("fresh eyes")
    - Main agent synthesizes findings from both tracks
  </overview>

  <prerequisites>
    <requirement>First time setup: cd ~/.claude/skills/debug-mode && bun install</requirement>
    <requirement>Add to PATH: ln -s ~/.claude/skills/debug-mode/bin/debug-mode ~/agent-tools/bin/</requirement>
    <requirement>Requires: bun, tmux, codex CLI (for Track B)</requirement>
  </prerequisites>

  <cli_commands>
    The debug-mode CLI provides utilities for managing debug sessions:

    debug-mode init <project>         Initialize worktrees and progress docs
    debug-mode cleanup <project>      Complete cleanup of all artifacts
    debug-mode codex run <n> <file>   Run Codex iteration N with prompt file
    debug-mode codex poll             Check Codex session status
    debug-mode status <track>         Check progress doc for signals
  </cli_commands>

  <critical_rule>
    NEVER attempt to fix the bug immediately. You MUST follow the dual-track
    debugging workflow. Speculative fixes without runtime evidence are prohibited.
    Wait for both tracks to complete before synthesizing findings.
  </critical_rule>

  <workflow>
    <phase name="1. HYPOTHESIZE" agent="main">
      Generate 6+ distinct hypotheses about what could cause the bug.
      These hypotheses are shared by BOTH tracks.

      Requirements:
      - Read relevant code to understand the execution flow
      - List at least 6 different potential root causes
      - Include both obvious causes and non-obvious edge cases
      - Do NOT touch any code yet

      Output format:
      ```
      Hypothesis 1: [Description]
      Hypothesis 2: [Description]
      Hypothesis 3: [Description]
      Hypothesis 4: [Description]
      Hypothesis 5: [Description]
      Hypothesis 6: [Description]
      ```
    </phase>

    <phase name="2. INITIALIZE WORKTREES AND PROGRESS DOCS" agent="main">
      Use the CLI to create worktrees and progress docs:

      ```bash
      debug-mode init /path/to/project
      ```

      This creates:
      - Worktrees: /tmp/debug-track-a, /tmp/debug-track-b
      - Progress docs: /tmp/debug-track-a-progress.md, /tmp/debug-track-b-progress.md

      Then manually update the progress docs with the actual bug description,
      reproduction command, and hypotheses from Phase 1.

      Each track works in its own worktree - no conflicts possible.
    </phase>

    <phase name="3. SPAWN PARALLEL TRACKS" agent="main">
      Launch BOTH tracks as background subagents. Each subagent manages its own
      iteration loop independently. Main agent waits for both to complete.

      Track A (Claude subagent):
      ```
      Task(
        subagent_type="general-purpose",
        prompt="{track_a_orchestrator_prompt}",
        run_in_background=true
      )
      ```

      Track B (Claude subagent managing Codex/GPT 5.2):
      ```
      Task(
        subagent_type="general-purpose",
        prompt="{track_b_orchestrator_prompt}",
        run_in_background=true
      )
      ```

      Both subagents run independently in the background. They handle their own
      iteration loops, polling, and progress doc updates. Main agent uses
      TaskOutput to wait for both to complete.

      See <track_orchestrator_prompts> for the prompts each subagent receives.
    </phase>

    <phase name="4. WAIT FOR COMPLETION" agent="main">
      Main agent waits for both background subagents to complete.
      Each subagent handles its own iteration loop internally.

      ```
      # Wait for both tracks (can check periodically or block)
      track_a_result = TaskOutput(task_id=track_a_id, block=true)
      track_b_result = TaskOutput(task_id=track_b_id, block=true)
      ```

      The subagents will:
      - Run up to 5 iterations each
      - Spawn fresh sub-subagents for "fresh eyes" review (Track A)
      - Spawn fresh codex exec calls (Track B)
      - Update their progress docs after each iteration
      - Terminate when "READY FOR FIX" or "EARLY EXIT" is reached, or max iterations

      Main agent can optionally poll with block=false to show progress to user.
    </phase>

    <phase name="5. SYNTHESIZE" agent="main">
      When both tracks complete:

      1. Read final progress docs:
         - /tmp/debug-track-a-progress.md
         - /tmp/debug-track-b-progress.md

      2. Compare findings:
         - Which hypotheses did Claude confirm/disprove?
         - Which hypotheses did GPT confirm/disprove?
         - Do they agree on root cause?
         - Any complementary insights?

      3. Decide on fix strategy:
         - Both agree: High confidence, proceed with shared root cause
         - Disagree: Evaluate evidence quality, may be multiple issues
         - Complementary: Combine insights for comprehensive fix
    </phase>

    <phase name="6. FIX" agent="main">
      Apply targeted fix based on synthesized findings:

      - The fix MUST be justified by log evidence from at least one track
      - Prefer 2-3 line fixes over large refactors
      - Run reproduction to verify fix works
      - Ask user to verify in their environment
    </phase>

    <phase name="7. CLEANUP" agent="main">
      After user confirms fix works:

      1. Apply the fix to main worktree (if developed in a track worktree):
         ```bash
         git diff /tmp/debug-track-{a|b}/path/to/file path/to/file
         ```

      2. Run the cleanup command:
         ```bash
         debug-mode cleanup /path/to/project
         ```

         This will:
         - Kill tmux session
         - Remove worktrees and branches
         - Delete all temp files
         - List remaining [DEBUG_AGENT] lines for manual removal

      3. Manually remove any [DEBUG_AGENT] lines listed in the output.

      This phase is MANDATORY. Never leave debug artifacts behind.
    </phase>
  </workflow>

  <meta_prompt_template>
    Use this template when spawning subagents in either track:

    ```
    ## Debug Track {A|B} - Subagent {N}

    ### Bug Description
    {original_bug_description}

    ### Hypotheses (shared across both tracks)
    {all_hypotheses_with_current_status}

    ### Your Worktree (IMPORTANT)
    Path: {/tmp/debug-track-a or /tmp/debug-track-b}

    You are working in an ISOLATED git worktree. All file edits and commands
    should be executed in YOUR worktree. The other track has its own worktree.
    This prevents conflicts between tracks.

    ### Progress Document
    Path: {/tmp/debug-track-a-progress.md or /tmp/debug-track-b-progress.md}

    FIRST: Read the progress document to understand what previous subagents discovered.
    LAST: Update the progress document with your findings before completing.

    ### Your Task
    You are Subagent {N} in the chain. Review and improve upon previous work.

    1. READ PROGRESS DOC
       - What hypotheses were tested?
       - What was confirmed/disproved?
       - What remains inconclusive?

    2. REVIEW previous findings
       - Do the log interpretations make sense?
       - Were any edge cases missed?
       - Is more instrumentation needed?

    3. INSTRUMENT: Add [DEBUG_AGENT] logging if needed
       - JavaScript/TypeScript: console.log('[DEBUG_AGENT] ...')
       - Python: print('[DEBUG_AGENT] ...')
       - Focus on gaps identified in review

    4. REPRODUCE: Run the reproduction command
       - Command: {reproduction_command}
       - Capture all [DEBUG_AGENT] output

    5. ANALYZE: Update hypothesis status
       - CONFIRMED | DISPROVED | INCONCLUSIVE
       - Cite specific log evidence

    6. UPDATE PROGRESS DOC: Append your findings
       ```markdown
       ## Iteration {N} - Subagent {N}

       ### Review of Previous Work
       {assessment}

       ### New Instrumentation Added
       {files and log statements, or "None - previous work sufficient"}

       ### Reproduction Results
       {key log output, or "Verified previous results"}

       ### Hypothesis Status Update
       - Hypothesis 1: {STATUS} - {evidence}
       - Hypothesis 2: {STATUS} - {evidence}
       ...

       ### Recommended Next Steps
       One of:
       - {guidance for next subagent to continue investigating}
       - "READY FOR FIX: {root_cause}" - if root cause is definitively confirmed
       - "EARLY EXIT: {reason}" - if previous subagent's work is solid (see criteria below)
       ```

    ## Early Exit Criteria (use sparingly)
    You may declare "EARLY EXIT" ONLY if ALL of the following are true:
    1. Previous subagent declared "READY FOR FIX" with a specific root cause
    2. You reviewed the evidence and it is conclusive (not circumstantial)
    3. You re-ran reproduction and confirmed the logs support the conclusion
    4. You found NO gaps, missed edge cases, or alternative explanations
    5. The proposed fix directly addresses the confirmed root cause

    If ANY doubt exists, continue the investigation. Early exit should be RARE.

    DO NOT remove [DEBUG_AGENT] logging - main agent handles cleanup.
    ```
  </meta_prompt_template>

  <track_orchestrator_prompts>
    These prompts are given to the background subagents that manage each track.

    ## Track A Orchestrator (Claude managing Claude sub-subagents)

    You are the Track A orchestrator for debug mode. Your job is to manage a chain
    of debugging iterations using Claude sub-subagents.

    Worktree: /tmp/debug-track-a
    Progress Doc: /tmp/debug-track-a-progress.md

    Your Task - Run up to 5 iterations of debugging:

    1. Spawn a fresh sub-subagent using Task(subagent_type="general-purpose")
       with the iteration prompt from meta_prompt_template
    2. Wait for it to complete (do NOT use run_in_background for sub-subagents)
    3. Read the updated progress doc
    4. Check for "READY FOR FIX" or "EARLY EXIT"
       - If found: stop iterating, report final findings
       - If not found and iterations < 5: continue to next iteration
    5. After all iterations, summarize findings in progress doc

    Each sub-subagent gets a FRESH context for "fresh eyes" review.
    The progress doc provides continuity between iterations.

    When complete, your final message should summarize:
    - Which hypotheses were confirmed/disproved
    - The identified root cause (if found)
    - Recommended fix

    ## Track B Orchestrator (Claude managing Codex/GPT 5.2)

    You are the Track B orchestrator for debug mode. Your job is to manage a chain
    of debugging iterations using Codex CLI (GPT 5.2).

    Worktree: /tmp/debug-track-b
    Progress Doc: /tmp/debug-track-b-progress.md

    Your Task - Run up to 5 iterations of debugging via Codex:

    1. Write the iteration prompt (from meta_prompt_template) to /tmp/track-b-prompt.md
    2. Launch codex using the CLI:
       debug-mode codex run {N} /tmp/track-b-prompt.md
    3. Poll until complete:
       debug-mode codex poll
       (repeat until status is DONE or FAILED)
    4. If status is FAILED, note the error and continue to next iteration
    5. Check progress status:
       debug-mode status track-b
    6. If signal is "READY_FOR_FIX" or "EARLY_EXIT": stop iterating
    7. If signal is "CONTINUE" and iterations < 5: continue to next iteration
    8. After all iterations, summarize findings in progress doc

    Each codex exec call is FRESH (not resumed) for "fresh eyes" review.
    The progress doc provides continuity between iterations.

    When complete, your final message should summarize:
    - Which hypotheses were confirmed/disproved
    - The identified root cause (if found)
    - Recommended fix
  </track_orchestrator_prompts>

  <when_to_use>
    <trigger>User describes a bug that's hard to reproduce</trigger>
    <trigger>Standard fix attempts have failed</trigger>
    <trigger>Bug involves timing, race conditions, or state issues</trigger>
    <trigger>User says "I don't understand why this is happening"</trigger>
    <trigger>User explicitly activates with /debug command</trigger>
    <trigger>Bug behavior is inconsistent or intermittent</trigger>
    <trigger>CI/E2E test failures (Playwright, Cypress, Selenium, Puppeteer)</trigger>
    <trigger>Flaky tests that pass/fail intermittently</trigger>
    <trigger>Test timeouts or hanging tests</trigger>
  </when_to_use>

  <tool_integration>
    For browser/E2E bugs, subagents can use chrome-devtools-testing skill:
    - getConsoleMessages() captures [DEBUG_AGENT] logs from browser
    - getNetworkRequests() for API debugging
    - Screenshots for visual state verification
  </tool_integration>

  <iteration_expectations>
    Debugging complex bugs typically requires multiple iterations per track:

    - 3-5 subagents per track is NORMAL for non-trivial bugs
    - Each subagent builds on accumulated knowledge
    - The progress doc prevents context loss between subagents
    - Real example: "3-day manual debug became 15 mins with ~8 total iterations"

    Do NOT give up after 1-2 subagents. Persist until root cause is confirmed.
  </iteration_expectations>

  <anti_patterns>
    <avoid name="Speculative fixes">
      WRONG: "Based on reading the code, I think the issue is X. Let me fix it."
      RIGHT: "Let me spawn both debug tracks to gather runtime evidence."
    </avoid>

    <avoid name="Single-track debugging">
      WRONG: "I'll just use Claude to debug this."
      RIGHT: "I'll run both Claude and GPT tracks for diverse perspectives."
    </avoid>

    <avoid name="Ignoring progress docs">
      WRONG: Each subagent starts fresh without reading previous work.
      RIGHT: Each subagent reads progress doc first, then builds upon it.
    </avoid>

    <avoid name="Abandoning cleanup">
      WRONG: "The bug is fixed. We're done."
      RIGHT: "Now I'll remove all [DEBUG_AGENT] logs and delete progress docs."
    </avoid>

    <avoid name="Premature early exit">
      WRONG: "Previous subagent found something, looks fine, EARLY EXIT."
      RIGHT: "Previous subagent found something. Let me verify by re-running reproduction
              and checking for edge cases before deciding if early exit is warranted."

      Early exit requires ALL 5 criteria to be met. When in doubt, continue investigating.
    </avoid>
  </anti_patterns>

  <example_session>
    User: "The form submission sometimes fails silently. No error, just nothing happens."

    Phase 1 - HYPOTHESIZE (main agent):
    1. Event handler not attached correctly on some renders
    2. Async validation failing silently
    3. Network request failing without error handling
    4. Race condition between form state and submit
    5. Browser extension interference
    6. CORS issue on certain requests

    Phase 2 - INITIALIZE (main agent):
    - Run: debug-mode init /path/to/project
    - Update progress docs with bug description and hypotheses

    Phase 3 - SPAWN TRACKS (main agent):
    - Track A: Task(subagent_type="general-purpose", prompt=track_a_orchestrator, run_in_background=true)
    - Track B: Task(subagent_type="general-purpose", prompt=track_b_orchestrator, run_in_background=true)

    Phase 4 - WAIT (main agent):
    - Both orchestrator subagents run independently in background
    - Track A orchestrator spawns: A1 -> A2 -> A3 (sub-subagents)
    - Track B orchestrator runs: codex B1 -> B2 (via tmux)
    - Main agent waits with TaskOutput(block=true) for both

    Phase 5 - SYNTHESIZE (main agent):
    - Track A concluded: Hypothesis 2 CONFIRMED (validation)
    - Track B concluded: Hypothesis 2 CONFIRMED (validation) + Hypothesis 4 partial
    - Both tracks agree: async validation is the root cause

    Phase 6 - FIX (main agent):
    Apply fix to main worktree: proper error state for validation failures (3 lines)

    Phase 7 - CLEANUP (main agent):
    - Run: debug-mode cleanup /path/to/project
    - Manually remove [DEBUG_AGENT] lines listed in output
  </example_session>
</debug_mode_skill>
