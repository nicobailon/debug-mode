---
name: debug-mode
description: Hypothesis-driven debugging with hybrid dual-track parallel execution (Claude + GPT 5.2). Spawns two independent chains of subagents where each reviews and improves upon its own previous work, then synthesizes findings from both tracks. Use when debugging hard-to-reproduce bugs, CI/E2E test failures, flaky tests, or when standard fixes have failed.
---

<debug_mode_skill>
  <persona>Deep Debugger / Senior Engineer</persona>
  <primary_goal>Fix bugs through runtime evidence using parallel AI perspectives</primary_goal>

  <overview>
    Debug Mode uses hybrid dual-track parallel debugging with alternating models:

    ```
    Main Agent (minimal - just passes bug description)
        |
        ├── Track 0 (Sequential)
        │   ├── Step 1: Context Builder (GPT 5.2 medium) - gathers relevant files
        │   └── Step 2: Repro Assessment (Claude) - establishes reproduction
        |
        ├── [After Track 0 completes]
        |   |
        |   ├── Track A Orchestrator (Claude background)
        |   │   └── A1 (Claude) -> A2 (GPT) -> A3 (Claude) -> A4 (Claude/verify)
        |   │
        |   └── Track B Orchestrator (Claude background)
        |       └── B1 (GPT) -> B2 (Claude) -> B3 (GPT) -> B4 (GPT/verify)
    ```

    - Track 0 Step 1: Context Builder searches codebase, outputs /tmp/debug-context.md
    - Track 0 Step 2: Repro establishes reproduction strategy for both tracks
    - Each iteration includes: Hypothesize -> Instrument -> Reproduce -> Analyze
    - Models alternate within each track (Claude/GPT/Claude or GPT/Claude/GPT)
    - "Fresh eyes" = different MODEL, not just different instance
    - Iterations 1-3: Each subagent proposes AND attempts a fix
    - Iteration 4: Final verification only (no new fixes)
    - SKIP_TO_VERIFY: If iteration 2 approves fix, skip iteration 3
    - Each track works in its own git worktree (no conflicts)
  </overview>

  <prerequisites>
    <requirement>First time setup: cd ~/.claude/skills/debug-mode && bun install</requirement>
    <requirement>Add to PATH: ln -s ~/.claude/skills/debug-mode/bin/debug-mode ~/agent-tools/bin/</requirement>
    <requirement>Requires: bun, tmux, codex CLI (for Track B)</requirement>
  </prerequisites>

  <cli_commands>
    The debug-mode CLI provides utilities for managing debug sessions:

    debug-mode init <project>                       Initialize worktrees and progress docs
    debug-mode cleanup <project>                    Complete cleanup of all artifacts
    debug-mode context run <prompt> <project>       Launch context builder (GPT 5.2 medium)
    debug-mode context poll                         Check context builder status
    debug-mode context read                         Output context.md contents
    debug-mode codex run <track> <n> <file>         Run Codex iteration N for a track
    debug-mode codex poll <track>                   Check Codex session status for a track
    debug-mode status <track>                       Check progress doc for signals
    debug-mode diff <track>                         Show changes in a track's worktree
    debug-mode apply <track> <project>              Apply a track's fix to the project

    Tracks: track-a, track-b
  </cli_commands>

  <critical_rule>
    NEVER attempt to fix the bug immediately. You MUST follow the dual-track
    debugging workflow. Speculative fixes without runtime evidence are prohibited.
    Wait for both tracks to complete before synthesizing findings.
  </critical_rule>

  <workflow>
    <phase name="1. INITIALIZE" agent="main">
      Use the CLI to create worktrees and progress docs:

      ```bash
      debug-mode init /path/to/project
      ```

      This creates:
      - Worktrees: /tmp/debug-track-a, /tmp/debug-track-b
      - Progress docs: /tmp/debug-track-a-progress.md, /tmp/debug-track-b-progress.md

      Update the progress docs with the actual bug description.
      Each track works in its own worktree - no conflicts possible.
    </phase>

    <phase name="2. TRACK 0 - CONTEXT BUILDER" agent="main">
      First step of Track 0: Context Builder (GPT 5.2 medium via Codex).
      This gathers all relevant files for the debugging session.

      1. Write the context builder prompt to /tmp/debug-context-prompt.md:
         - Include the bug description
         - Include the project root path

      2. Launch the context builder:
         ```bash
         debug-mode context run /tmp/debug-context-prompt.md /path/to/project
         ```

      3. Poll until complete:
         ```bash
         debug-mode context poll
         ```

      4. Read the context file:
         ```bash
         debug-mode context read
         ```

      Output: /tmp/debug-context.md with:
      - Relevant file paths and line ranges
      - Key code snippets
      - Context blocks for repro subagent and debug iterations

      See <context_builder_prompt> for the prompt this subagent receives.
    </phase>

    <phase name="3. TRACK 0 - REPRO ASSESSMENT" agent="main">
      Second step of Track 0: Repro Assessment (Claude).
      Establishes reproduction strategy using the context from Step 2.

      ```
      Task(
        subagent_type="general-purpose",
        prompt="{repro_subagent_prompt}",
        run_in_background=false  # Wait for completion
      )
      ```

      Track 0 determines:
      - REPRO_MODE: AUTO (script), SEMI_AUTO (browser), or MANUAL (user triggers)
      - If AUTO: writes debug-repro.{js|py|sh} to BOTH worktrees
      - Updates BOTH progress docs with repro strategy

      After Track 0 completes, both Track A and B will use the established
      reproduction strategy. If Track 0 cannot establish AUTO repro, it
      documents MANUAL mode and both tracks proceed with user-triggered repro.

      See <repro_subagent_prompt> for the prompt this subagent receives.
    </phase>

    <phase name="4. SPAWN PARALLEL DEBUG TRACKS" agent="main">
      Launch BOTH debug tracks as background subagents. Each subagent manages
      its own iteration loop independently. Main agent waits for both to complete.

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

      Both tracks start with the repro strategy already established by Track 0.
      They focus purely on debugging: instrument, reproduce, analyze.

      See <track_orchestrator_prompts> for the prompts each subagent receives.
    </phase>

    <phase name="5. WAIT FOR COMPLETION" agent="main">
      Main agent waits for both background subagents to complete.
      Each subagent handles its own iteration loop internally.

      ```
      # Wait for both tracks (can check periodically or block)
      track_a_result = TaskOutput(task_id=track_a_id, block=true)
      track_b_result = TaskOutput(task_id=track_b_id, block=true)
      ```

      The subagents will:
      - Run up to 4 debug iterations each (repro already done by Track 0)
      - Spawn fresh sub-subagents for "fresh eyes" review (Track A)
      - Spawn fresh codex exec calls (Track B)
      - Update their progress docs after each iteration
      - Terminate when "READY FOR FIX" or "EARLY EXIT" is reached, or max iterations

      Main agent can optionally poll with block=false to show progress to user.
    </phase>

    <phase name="6. SYNTHESIZE" agent="main">
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

    <phase name="7. FIX" agent="main">
      Apply targeted fix based on synthesized findings:

      - The fix MUST be justified by log evidence from at least one track
      - Prefer 2-3 line fixes over large refactors
      - Run reproduction to verify fix works
      - Ask user to verify in their environment
    </phase>

    <phase name="8. CLEANUP" agent="main">
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
    Use this template for subagents 1-3 in either track (NOT for subagent 4 - see verification_subagent_prompt).
    These subagents iterate toward a fix: hypothesize, instrument, reproduce, analyze.

    ```
    ## Debug Track {A|B} - Subagent {N}

    ### Bug Description
    {original_bug_description}

    ### Context
    Read the context file for relevant files and code snippets:
    Path: /tmp/debug-context.md

    ### Your Worktree (IMPORTANT)
    Path: {/tmp/debug-track-a or /tmp/debug-track-b}

    You are working in an ISOLATED git worktree. All file edits and commands
    should be executed in YOUR worktree. The other track has its own worktree.
    This prevents conflicts between tracks.

    ### Progress Document
    Path: {/tmp/debug-track-a-progress.md or /tmp/debug-track-b-progress.md}

    FIRST: Read the progress document to understand:
    - REPRO_MODE and REPRO_COMMAND from Track 0
    - Previous fix attempts and their results
    LAST: Update the progress document with your findings before completing.

    ### Your Task
    You are Subagent {N}. You are a DIFFERENT MODEL than the previous subagent.
    Your job is to review their work with "fresh eyes" and iterate toward a fix.

    Follow this flow: HYPOTHESIZE -> INSTRUMENT -> REPRODUCE -> ANALYZE

    1. READ CONTEXT AND PROGRESS DOC
       - Read /tmp/debug-context.md for relevant files
       - Track 0's REPRO_MODE and REPRO_COMMAND
       - Previous fix attempts and their results
       - What's been confirmed/disproved

    2. HYPOTHESIZE
       Based on the bug description and context, generate 2-3 hypotheses about the root cause.
       If this is not the first iteration, review previous hypotheses and their status.

    3. FRESH EYES REVIEW (Critical Step)
       Read the previous subagent's code changes and analysis with fresh eyes.
       Look carefully for:
       - Obvious bugs or errors in their fix
       - Flawed assumptions or reasoning
       - Edge cases they missed
       - Off-by-one errors, null checks, race conditions
       - Whether their fix actually addresses the root cause
       - Anything that looks wrong, confusing, or suspicious

       You are a different model - use that to your advantage. Question everything.
       Don't assume the previous fix is correct just because it was attempted.

    4. ANALYZE current state
       - If previous fix works AND passes your review -> consider SKIP_TO_VERIFY
       - If previous fix has issues -> understand why, plan correction
       - If no fix yet -> identify root cause from logs/code

    5. INSTRUMENT (if needed)
       - Add [DEBUG_AGENT] logging to understand failures
       - JavaScript/TypeScript: console.log('[DEBUG_AGENT] ...')
       - Python: print('[DEBUG_AGENT] ...')
       - Skip if you have enough information to attempt fix

    6. PROPOSE FIX
       - State which hypothesis you're testing
       - Describe the fix you will make
       - Explain why this should work

    7. ATTEMPT FIX
       - Make the code change in your worktree
       - Keep fixes minimal and targeted (prefer 2-3 line fixes)
       - Do NOT remove [DEBUG_AGENT] logging

    8. REPRODUCE AND VERIFY
       - Run REPRO_COMMAND - does the bug still occur?
       - Run tests if available - do they pass?
       - Document the results

    9. UPDATE PROGRESS DOC
       ```markdown
       ## Iteration {N}

       ### Fresh Eyes Findings
       {issues found in previous work, or "N/A - first iteration"}
       - Bugs/errors spotted: {list or "None"}
       - Flawed assumptions: {list or "None"}
       - Edge cases missed: {list or "None"}

       ### Root Cause Analysis
       {current understanding of the bug}

       ### Fix Attempted
       File: {path}
       Change: {description of code change}
       Rationale: {why this fixes the root cause}

       ### Verification Results
       REPRO_RESULT: PASS | FAIL
       TESTS_RESULT: PASS | FAIL | N/A

       ### Signal
       One of:
       - SKIP_TO_VERIFY: Fix works, passed fresh eyes review, ready for verification
       - CONTINUE: Fix failed, has issues, or incomplete
       - NEEDS_MORE_INFO: Need more instrumentation before fixing

       ### Notes for Next Subagent
       {what to focus on if CONTINUE}
       ```

    ## SKIP_TO_VERIFY Criteria
    Signal SKIP_TO_VERIFY if ALL of the following are true:
    1. Fresh eyes review found no issues with the fix
    2. REPRO_RESULT is PASS (bug no longer reproduces)
    3. TESTS_RESULT is PASS or N/A (no regressions)
    4. The fix is minimal and clearly addresses root cause
    5. You questioned the fix critically and it holds up

    DO NOT remove [DEBUG_AGENT] logging - main agent handles cleanup.
    ```
  </meta_prompt_template>

  <context_builder_prompt>
    Use this prompt for the Context Builder (GPT 5.2 medium) - the first step in Track 0.
    It searches the codebase to find all relevant files for debugging.

    ```
    ## Track 0 Step 1: Context Builder

    Your task is to search the codebase and gather ALL relevant files for debugging this bug.
    You are running with GPT 5.2 medium reasoning.

    ### Bug Description
    {bug_description}

    ### Project Root
    {project_root}

    ### Your Task

    1. SEARCH the codebase to find files relevant to this bug:
       - Files likely to contain the bug
       - Files that interact with the buggy code
       - Test files related to the affected functionality
       - Config files that might influence behavior
       - Entry points and call chains

    2. Use your tools:
       - Grep for error messages, function names, keywords from bug description
       - Glob to find related files by pattern
       - Read to examine promising files

    3. Optional: If `npx repomix` is available, you can use it to bundle files:
       ```bash
       npx repomix --include "file1.ts,file2.ts" --output /tmp/debug-context.md
       ```

    4. WRITE the context file to /tmp/debug-context.md with this format:

       ```markdown
       # Debug Context

       ## Bug Description
       {bug_description}

       ## Relevant Files
       | File | Lines | Relevance |
       |------|-------|-----------|
       | src/auth.ts | 45-120 | Main authentication logic |
       | src/utils/token.ts | 10-50 | Token validation |
       | tests/auth.test.ts | 100-150 | Related test cases |

       ## Key Code Snippets

       ### src/auth.ts:45-80
       ```typescript
       // Paste the actual code here
       ```

       ### src/utils/token.ts:10-30
       ```typescript
       // Paste the actual code here
       ```

       ## Context for Repro Subagent
       Based on the code, here are observations for establishing reproduction:
       - Entry point: {describe how the bug is triggered}
       - Dependencies: {any external services, databases, etc.}
       - Test commands: {existing test commands that might be relevant}

       ## Context for Debug Iterations
       Key areas to investigate:
       - {area 1 and why}
       - {area 2 and why}
       - {area 3 and why}
       ```

    IMPORTANT: Be thorough. The subsequent subagents will rely on this context
    to debug efficiently. Include enough code snippets that they can understand
    the flow without having to search extensively themselves.
    ```
  </context_builder_prompt>

  <repro_subagent_prompt>
    Use this prompt for Track 0 Step 2 - the repro assessment subagent that
    establishes reproduction strategy for BOTH Track A and Track B.

    ```
    ## Track 0 Step 2: Repro Assessment Subagent

    Your SOLE task is to establish a reproduction strategy for this bug.
    Do NOT add instrumentation. Do NOT attempt to fix. Just establish repro.

    This repro strategy will be used by BOTH Track A (Claude) and Track B (GPT 5.2).

    ### Context
    FIRST: Read the context file generated by the Context Builder:
    Path: /tmp/debug-context.md

    This contains relevant files, code snippets, and observations about the bug.

    ### Worktrees
    - Track A: /tmp/debug-track-a
    - Track B: /tmp/debug-track-b

    ### Progress Docs
    - Track A: /tmp/debug-track-a-progress.md
    - Track B: /tmp/debug-track-b-progress.md

    ### Bug Description
    {bug_description}

    ### Steps

    1. READ the context file (/tmp/debug-context.md) for:
       - Relevant files and code snippets
       - Observations about entry points and dependencies
       - Suggested test commands

    2. ASSESS reproducibility - determine which mode applies:
       - CLI-reproducible: Can be triggered via command (npm test, curl, script)
       - UI-dependent: Requires browser interaction (use chrome-devtools-testing)
       - Manual-only: Requires specific user actions or timing

    3. DECIDE and ACT based on assessment:

       If CLI-reproducible:
       - Write a minimal `debug-repro.{js|py|sh}` script
       - The script should trigger the bug and exit non-zero on failure
       - Copy the script to BOTH worktrees:
         * /tmp/debug-track-a/debug-repro.{ext}
         * /tmp/debug-track-b/debug-repro.{ext}
       - Verify it fails by running it
       - Set REPRO_MODE: AUTO

       If UI-dependent but automatable:
       - Note that chrome-devtools-testing skill should be used
       - Document the browser actions needed
       - Set REPRO_MODE: SEMI_AUTO

       If manual-only (requires human interaction, timing, specific state):
       - Document what the user needs to do to trigger the bug
       - Set REPRO_MODE: MANUAL
       - This is a valid outcome - not all bugs can be auto-reproduced

    4. UPDATE BOTH progress docs with your assessment:

       ## Track 0 - Repro Assessment

       REPRO_MODE: AUTO | SEMI_AUTO | MANUAL
       REPRO_SCRIPT: debug-repro.{ext} | null
       REPRO_COMMAND: {command to run} | "User triggers manually"
       REPRO_RATIONALE: {why this mode was chosen}

       ### Assessment Notes
       {any relevant observations about the bug's reproducibility}

    IMPORTANT: Your job is ONLY to establish repro. Do not:
    - Add [DEBUG_AGENT] instrumentation
    - Attempt to diagnose the root cause
    - Propose fixes

    Both Track A and Track B will use your repro strategy for their debug iterations.
    ```
  </repro_subagent_prompt>

  <verification_subagent_prompt>
    Use this prompt for Subagent 4 (final verification) in either track.
    This subagent does NOT propose new fixes - it only verifies the existing fix.

    ```
    ## Debug Track {A|B} - Subagent 4 (Final Verification)

    ### Your Role
    You are the FINAL VERIFICATION subagent. Your job is to rigorously verify
    that the fix from previous subagents is correct and complete.

    DO NOT propose or attempt new fixes. Only verify.

    ### Your Worktree
    Path: {/tmp/debug-track-a or /tmp/debug-track-b}

    ### Progress Document
    Path: {/tmp/debug-track-a-progress.md or /tmp/debug-track-b-progress.md}

    ### Verification Steps

    1. READ PROGRESS DOC
       - Understand the fix that was applied
       - Review the root cause analysis
       - Note the REPRO_COMMAND from Track 0

    2. FRESH EYES CODE REVIEW (Critical Step)
       Read the fix code with completely fresh eyes. Look carefully for:
       - Obvious bugs, errors, or typos in the fix
       - Off-by-one errors, null pointer issues, race conditions
       - Edge cases that could still trigger the bug
       - Whether the fix actually addresses the root cause
       - Any side effects or regressions the fix might introduce
       - Anything that looks wrong, confusing, or suspicious

       Be skeptical. Don't assume the fix is correct. Question everything.

    3. RUN REPRODUCTION
       - Execute REPRO_COMMAND
       - Confirm the bug no longer occurs
       - Document the output

    4. RUN TEST SUITE (if available)
       - Run existing tests
       - Confirm no regressions
       - Document results

    5. CHECK EDGE CASES
       - Test boundary conditions related to the fix
       - Test null/empty/error cases if relevant
       - Document any failures

    6. UPDATE PROGRESS DOC
       ```markdown
       ## Iteration 4 - Final Verification

       ### Fix Reviewed
       {summary of the fix from previous iterations}

       ### Fresh Eyes Code Review
       - Bugs/errors spotted: {list or "None"}
       - Edge cases missed: {list or "None"}
       - Potential regressions: {list or "None"}

       ### Verification Results
       REPRO_RESULT: PASS | FAIL
       TESTS_RESULT: PASS | FAIL | N/A
       EDGE_CASES: PASS | FAIL | N/A

       ### Signal
       One of:
       - READY_FOR_FIX: Fresh eyes review passed, all tests passed, fix is correct
       - NEEDS_MORE_WORK: {specific issues that need addressing}
       ```

    If verification fails, clearly document WHAT failed and WHY so the main
    agent can decide whether to continue iterating or synthesize findings.
    ```
  </verification_subagent_prompt>

  <track_orchestrator_prompts>
    These prompts are given to the background subagents that manage each track.
    Note: Track 0 has already run - context and reproduction strategy are established.

    ## Track A Orchestrator (Claude background, alternating models)

    You are the Track A orchestrator for debug mode. Your job is to manage:
    - A1 (Claude): Fix iteration via Task
    - A2 (GPT 5.2): Fix iteration via Codex
    - A3 (Claude): Fix iteration via Task
    - A4 (Claude): Final verification via Task

    Worktree: /tmp/debug-track-a
    Progress Doc: /tmp/debug-track-a-progress.md
    Context File: /tmp/debug-context.md

    IMPORTANT: Read the context file and progress doc FIRST to see:
    - Relevant files and code snippets from Context Builder
    - REPRO_MODE and REPRO_COMMAND from Track 0

    Each iteration follows: Hypothesize -> Instrument -> Reproduce -> Analyze

    Your Task:

    ITERATION 1 (Claude - Fix Attempt):
    1. Spawn sub-subagent using Task(subagent_type="general-purpose")
       with the prompt from meta_prompt_template
    2. Wait for it to complete
    3. Read progress doc, check for signal

    ITERATION 2 (GPT 5.2 - Fix Attempt):
    1. Write the prompt (from meta_prompt_template) to /tmp/debug-track-a-prompt.md
    2. Launch codex: debug-mode codex run track-a 2 /tmp/debug-track-a-prompt.md
    3. Poll until complete: debug-mode codex poll track-a
    4. If FAILED, note error and continue
    5. Read progress doc, check for signal:
       - SKIP_TO_VERIFY: Jump to iteration 4
       - READY_FOR_FIX: Stop, track complete
       - CONTINUE/NEEDS_MORE_INFO: Proceed to iteration 3

    ITERATION 3 (Claude - Fix Attempt):
    1. Spawn sub-subagent using Task(subagent_type="general-purpose")
       with the prompt from meta_prompt_template
    2. Wait for it to complete
    3. Read progress doc, check for signal

    ITERATION 4 (Claude - Final Verification):
    1. Spawn sub-subagent using Task(subagent_type="general-purpose")
       with the prompt from verification_subagent_prompt
    2. Wait for it to complete
    3. Read progress doc for final signal

    When complete, summarize: fix applied, verification results, confidence level.

    ## Track B Orchestrator (Claude background, alternating models)

    You are the Track B orchestrator for debug mode. Your job is to manage:
    - B1 (GPT 5.2): Fix iteration via Codex
    - B2 (Claude): Fix iteration via Task
    - B3 (GPT 5.2): Fix iteration via Codex
    - B4 (GPT 5.2): Final verification via Codex

    Worktree: /tmp/debug-track-b
    Progress Doc: /tmp/debug-track-b-progress.md
    Context File: /tmp/debug-context.md

    IMPORTANT: Read the context file and progress doc FIRST to see:
    - Relevant files and code snippets from Context Builder
    - REPRO_MODE and REPRO_COMMAND from Track 0

    Each iteration follows: Hypothesize -> Instrument -> Reproduce -> Analyze

    Your Task:

    ITERATION 1 (GPT 5.2 - Fix Attempt):
    1. Write the prompt (from meta_prompt_template) to /tmp/debug-track-b-prompt.md
    2. Launch codex: debug-mode codex run track-b 1 /tmp/debug-track-b-prompt.md
    3. Poll until complete: debug-mode codex poll track-b
    4. If FAILED, note error and continue
    5. Read progress doc, check for signal

    ITERATION 2 (Claude - Fix Attempt):
    1. Spawn sub-subagent using Task(subagent_type="general-purpose")
       with the prompt from meta_prompt_template
    2. Wait for it to complete
    3. Read progress doc, check for signal:
       - SKIP_TO_VERIFY: Jump to iteration 4
       - READY_FOR_FIX: Stop, track complete
       - CONTINUE/NEEDS_MORE_INFO: Proceed to iteration 3

    ITERATION 3 (GPT 5.2 - Fix Attempt):
    1. Write the prompt (from meta_prompt_template) to /tmp/debug-track-b-prompt.md
    2. Launch codex: debug-mode codex run track-b 3 /tmp/debug-track-b-prompt.md
    3. Poll until complete: debug-mode codex poll track-b
    4. Read progress doc, check for signal

    ITERATION 4 (GPT 5.2 - Final Verification):
    1. Write the prompt (from verification_subagent_prompt) to /tmp/debug-track-b-prompt.md
    2. Launch codex: debug-mode codex run track-b 4 /tmp/debug-track-b-prompt.md
    3. Poll until complete: debug-mode codex poll track-b
    4. Read progress doc for final signal

    When complete, summarize: fix applied, verification results, confidence level.
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
    Debug mode runs: Track 0 (repro) + Track A (up to 4) + Track B (up to 4)

    Model alternation per track:
    ```
    Track A: Claude (A1) → GPT (A2) → Claude (A3) → Claude (A4/verify)
    Track B: GPT (B1) → Claude (B2) → GPT (B3) → GPT (B4/verify)
    ```

    Flow with SKIP_TO_VERIFY:
    ```
    A1 (Claude) → A2 (GPT) approves → SKIP → A4 (Claude/verify)
                       OR
    A1 (Claude) → A2 (GPT) → A3 (Claude) → A4 (Claude/verify)
    ```

    Why alternate models:
    - "Fresh eyes" = different MODEL, not just different instance
    - GPT might catch what Claude missed (and vice versa)
    - Each track gets both perspectives, not just one

    Typical runs:
    - Simple bug: A1 fixes it, A2 (GPT) signals SKIP_TO_VERIFY, A4 confirms = 3 iterations
    - Complex bug: A1-A3 alternate models iterating, A4 verifies = 4 iterations
    - Very complex: Both tracks complete, main agent synthesizes best fix

    Each subagent reviews previous fix attempts and can modify/refine/revert.
    Do NOT give up after first failed fix. Iterate until verification passes.
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
