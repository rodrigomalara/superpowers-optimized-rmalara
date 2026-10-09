---
name: using-superpowers
description: >
  Detailed workflow routing for full technical tasks: uncertain requirements,
  architecture, migrations, shared contracts, or wider changes. The injected
  startup router handles micro and bounded tasks without loading this skill.
  Use when full routing is needed or the user explicitly requests it.
---

# Using Superpowers

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill entirely.
</SUBAGENT-STOP>

## Trigger Conditions

The startup router is sufficient for micro and bounded tasks. Load this detailed skill for full tasks or when explicitly requested. Do not reload it just to enter a workflow already selected.

For full tasks, use this skill when any of the following occur:

- A new session starts with a technical request
- The user gives a new task or changes topic mid-session
- Any technical work is about to begin without a skill selected
- The user asks "what should I use" or "which workflow"

**Exception:** Micro tasks (typo fix, single variable rename, 1-line config change) can skip the entry sequence entirely. Just do them.

## When the User Names a Specific Skill

If the user's prompt references a skill by name (e.g., "use brainstorming," "use context management," "run verification"), that is a **Skill tool invocation request**:

1. Still complete Entry Sequence steps 1–6 (token-efficiency, staleness check, etc.) — these are always-on prerequisites, not routing.
2. **Invoke the named skill via the `Skill` tool.** Do not re-implement the skill's purpose with ad-hoc agents, manual file reads, or improvised workflows. The skill contains tested, structured logic — use it.
3. Skip complexity classification and routing (step 7) — the user already chose the route.

This is the most common cause of entry sequence bypass: the AI interprets "use X skill" as a goal to achieve creatively rather than as a tool invocation. It is always a tool invocation.

## Instruction Priority (highest to lowest)

1. Explicit user instructions in the current conversation
2. Project-level CLAUDE.md / AGENTS.md
3. Superpowers skill instructions

If a user explicitly overrides a skill's behavior, follow the user. Skills are defaults, not mandates.

## Core Rule

Before technical execution, select workflow skills explicitly and follow them.

Technical execution includes code edits, debugging, planning, review, test status claims, and branch integration actions.

## Entry Sequence

1. Invoke `token-efficiency` at session start — applies to all sessions, always.
2. **Fresh project gate** — evaluate both conditions in order:
   - The user's request contains creation/build intent: any of "build", "create", "make", "implement", "scaffold", "set up", "write", "generate", "develop", "start"
   - Run a filesystem check: `ls project-map.md 2>/dev/null` — gate only fires if the file does **not** exist

   If both are true, **pause before proceeding** and tell the user exactly this:

   > Before I start: this directory has no memory files set up yet. That matters for how well I perform across sessions.
   >
   > **Without setup, every future session on this project starts from scratch:**
   > - I re-explore the project structure even if I mapped it last session
   > - I re-read files I already understood
   > - I may re-propose approaches that were already tried and rejected
   > - I lose the "why" behind every decision the moment the session ends
   >
   > **A ~30-second setup changes that permanently:**
   > - `git init` — enables staleness tracking so I only re-read files that actually changed *(creates `.git` only, nothing else)*
   > - `project-map.md` — I read this at every future session start instead of re-exploring blind
   > - `session-log.md` — auto-captures what was built and decided, so future sessions start with: *"I see from last session that X was rejected because Y — building with that constraint already applied"* instead of rediscovering it
   >
   > **Set this up before we build, or start immediately?**

   Wait for the user's answer before continuing.
   - **If they confirm:** run `git init --quiet` directly (do not ask again — the user just confirmed), then invoke `context-management` for map generation only. Return to step 3 when done. Note: `context-snapshot.json` will not be created in this session — the context-engine hook already ran at session start before git existed. It will be created on the next session start, provided the session is opened from this project's root directory. If no commits exist yet it will be mostly empty; it populates fully after the first commit.
   - **If they decline:** proceed to step 3.

   **Step 2b — Existing project memory check** (runs only when step 2 did NOT fire):
   If the user's request is non-trivial (not micro) AND `project-map.md` does not exist AND the project has 10+ files:
   - Mention once (do not block): *"Note: this project has no project-map.md. I'll work fine without it, but if you want faster orientation in future sessions, I can generate one after this task. Just say 'map this project'."*
   - Do not repeat this notice in subsequent tasks within the same session.

3. Classify the task as **micro**, **lightweight**, or **full** (see Complexity Classification below).
4. If resuming work, use the injected `<state>` content; read `state.md` only for missing, omitted, or changed sections. Before ending any session where significant decisions were made (design choices, rejected approaches, non-obvious constraints discovered), invoke `context-management` to write a `[saved]` entry — even if the work is complete. This is the only mechanism that preserves the "why" across sessions.
5. Use injected `<known-issues>` content. Search `known-issues.md` only for relevant issues missing from that content or changed since injection.
6. Use the injected `<project-map>` to orient without re-reading it. Read `project-map.md` only for missing, omitted, or changed sections. The map tells you what exists and where — when you need a file's actual content (for modification, comparison, or debugging), read it directly with the Read tool. Staleness is detected automatically by the session-start hook: if the map is stale, a `<project-map-stale>` tag is injected into session context with the mismatched hashes. When you see that tag:
   - **With git:** use the changed-file list in the warning; run `git diff --name-only <map_hash> HEAD` only if the warning does not include a usable list. Re-read only those; everything else in the map is still valid. Update the corresponding Key Files entries in `project-map.md` and refresh the git hash and date in the header.
   - **Without git:** compare the map's generation timestamp to the modification time of files listed in the map's Hot Files section. Re-read any that are newer than the map. Then update their Key Files entries and refresh the generation timestamp in the header.
7. Follow the path for the classified complexity level.

## Complexity Classification

Classify every task as micro, bounded, lightweight, or full. Do not invoke a separate skill for this — decide inline.

### Full-task overrides

Use the full workflow for uncertain requirements, architectural decisions, migrations or data-shape changes, shared hooks/routing/configuration, shared or external contracts, and changes spanning modules. A condition or a user-visible change alone does not require the full workflow.

### Bounded (local behavior change)

All must hold:
- The user gives explicit requirements; no unresolved design decision.
- At most two files with local, understood dependencies.
- No architectural change, migration, shared hook/routing rule, or shared/external contract change.

Implement, verify, and review once for meaningful code changes. Apply test-driven-development for behavior changes and the relevant implementation skill. Skip brainstorming, formal plans, worktrees, and agent dispatch. A small local condition or user-visible behavior can qualify. If any criterion is uncertain, use full.

### Micro (skip everything)
- Typo fix, single variable rename, 1-line config change
- **Action:** Just do it. No skills needed.

### Lightweight (fast path)
All of these must be true:
- Change scope is small (~2 files or fewer)
- No new behavior or architecture change
- No cross-module dependency risk
- No migration or data-shape change

**Before classifying as lightweight:** explicitly state in one sentence why each of the four criteria above is satisfied. Do not assume. If you cannot articulate any one of them clearly, classify as full.

**Action:** Go directly to implementation. Only gate: invoke `verification-before-completion` when done. Skip brainstorming, planning, worktrees, and parallel dispatch.

**Exception:** If a dedicated implementation skill exists for this specific task (check the Routing Guide), invoke it — lightweight skips workflow overhead, not implementation skills.

### Full (complete pipeline)
Anything that does not qualify as micro, bounded, or lightweight.

**Action:** Follow the Routing Guide below for the full skill pipeline.

## EnterPlanMode Intercept

If Claude is about to enter plan mode (`EnterPlanMode`), check whether brainstorming has been completed for the current task:

- **No brainstorming done for this task**: invoke `brainstorming` first — plan mode without a validated design leads to plans built on unexamined assumptions.
- **Brainstorming already completed and design approved**: proceed to plan mode / `writing-plans`.

```dot
digraph planmode_intercept {
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Proceed to writing-plans" [shape=box];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Proceed to writing-plans" [label="yes"];
    "Invoke brainstorming skill" -> "Proceed to writing-plans";
}
```

## Routing Guide

- Uncertain whether work should exist at all: `premise-check` (run before brainstorming or planning)
- Complex decision with unclear options or possible mis-framing: `deliberation` → `brainstorming` → `writing-plans`
- New behavior outside the bounded route, or architecture (problem is well-framed): `brainstorming` → `writing-plans`
- Plan execution (same session, with optional parallel waves): `subagent-driven-development`
- Plan execution (separate session): `executing-plans`
- Experimental or risky work needing branch isolation: `using-git-worktrees` (run before implementation)
- Bug/test failure: `systematic-debugging` → `test-driven-development`
- Completion claim: `verification-before-completion`
- Branch integration: `finishing-a-development-branch`
- Code review (includes security): `requesting-code-review` / `receiving-code-review`
- Independent parallel tasks outside of plan execution: `dispatching-parallel-agents`
- Cross-session state persistence: `context-management`
- Known issue tracking / save recurring fixes: `error-recovery`
- Code restructuring without behavior change: `refactoring` (lock behavior with tests, then restructure incrementally)
- Performance issues (slow, high memory/CPU, latency): `performance-investigation` (measure → profile → fix → re-measure)
- Dependency updates, security vulnerabilities, migrations: `dependency-management` (audit → assess impact → update incrementally → verify)
- UI/frontend implementation: apply `frontend-design` standards
- CLAUDE.md / AGENTS.md creation or update: `claude-md-creator` (applies at any complexity level — never implement directly)
- *(Internal skills — not directly routed):* `self-consistency-reasoner` is invoked internally by `systematic-debugging` and `verification-before-completion`; do not invoke it directly. `token-efficiency` is always-on and invoked at step 1 of the Entry Sequence.

## Context Hygiene

For subagent handoffs, include only current task scope, constraints, evidence, and references to `state.md` when needed.

Avoid carrying forward long assistant reasoning chains unless they contain required artifacts.

## Structured Output Preference

When output feeds another agent/tool step, prefer JSON or YAML schemas defined by the active skill.

## Red Flags

- "I'll just do this first without a skill"
- "Keep all prior assistant text in context"
- Claiming "done" without running verification

If a red flag appears, restart from Entry Sequence.
