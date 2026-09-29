# About this fork

A fork of [REPOZY/superpowers-optimized](https://github.com/REPOZY/superpowers-optimized),
itself a fork of Jesse Vincent's [superpowers](https://github.com/obra/superpowers-marketplace).
MIT licensed, same as upstream. Forked at v6.8.1 (`38e85b9`).

The modifications are small and narrow: roughly 100 changed lines across 4 of the
plugin's 33 skill documents, under 2% of the skill text. Everything that makes this
plugin useful is Jesse Vincent's and REPOZY's work.

It changes three skills — `writing-plans`, `brainstorming` and
`subagent-driven-development` — to remove structural pressure toward scope creep in
implementation plans and in the review gates that execute them. Everything else is
upstream.

## The problem

Implementation plans produced with these skills tended to grow beyond the requested
change: proposing refactors alongside features, introducing abstractions nothing
asked for, and revising approaches that already worked because a different one looked
better. Not random drift — two specific mechanisms in the skill text produce it.

### 1. A one-directional scope ratchet

`writing-plans` Self-Review step 5 reads:

> **Scope-reduction scan:** Search the plan for: "v1", "basic", "simple", "for now",
> "placeholder", "initial version", "minimal". For each hit, verify it was explicitly
> sanctioned by the user — not a quiet scope downgrade from what was requested.

This is a good check. The problem is that nothing mirrors it. The self-review searches
for scope *reduction* and treats every hit as a defect to fix, while scope *expansion*
passes unexamined. Every planning pass applies upward pressure and none downward, so
plans drift in one direction by construction.

A second line in the same skill compounds it:

> if a file you're modifying has grown unwieldy, including a split in the plan is
> reasonable

That authorises folding restructuring into a feature plan — the exact bundling the
`refactoring` skill exists to keep separate, and without its behavior lock.

### 2. Mandated alternatives

`brainstorming` step 4 reads:

> Propose 2-3 approaches with trade-offs and a recommendation.

Unconditional. When the user has already chosen an approach, this requires the model
to generate competitors to it and recommend among them — manufacturing the "here's a
better way" proposal rather than responding to a real design question. Combined with
the Engineering Rigor section's `Prioritize modularity, SOLID principles, and
production-ready standards`, the design phase is pushed toward ambition regardless of
what was asked for.

## The changes

### `skills/writing-plans/SKILL.md`

- **Self-Review gains a scope-expansion scan** mirroring the existing reduction scan
  and equally binding. Each task must cite the spec requirement it serves; a task that
  cannot is cut. New abstractions, files beyond those the spec requires, renames and
  moves, changes to public signatures or wire formats or schemas, and error handling
  for unmentioned conditions are removed by default. Keeping one takes an explicit
  user decision, not the model's own assessment that it is better.
- **A `## Deferred` section** records exactly two kinds of finding: **bugs** (existing
  behavior already wrong, noticed while reading the code) and **scope-creep** (changes
  the expansion scan cut). Each kind has a fixed entry shape — a bug carries location,
  now vs expected, a `verified`/`suspected` confidence flag and impact; a cut change
  carries what it would touch, why it was cut, and what it would actually buy, where
  `unclear` is an allowed and informative answer. Entries never propose a fix or
  estimate effort: the section is a record the reader can act on, not a second plan.
- **A `Must not change:` field in the plan header.** The header carried Goal,
  Architecture, Tech Stack, Spec and Assumptions — nothing stating what the plan
  promises to leave alone. A plan could satisfy every other rule and still never
  declare its behavior contract. The field asks for it concretely, and any task
  touching one of the named things has to say so.
- **The file-split license is removed.** An unwieldy file is left alone and recorded as
  a cut change; restructuring travels through `refactoring`, which locks behavior with
  tests first, as separate work.

### `skills/brainstorming/SKILL.md`

- **Alternatives are conditional.** Propose 2-3 approaches when the user has not
  specified one. When they have, evaluate that approach — state what it costs and
  where it breaks — and design against it unless it cannot meet the requirements. An
  approach the model prefers but was not asked for goes to non-goals, named once.
- **Engineering Rigor reframed.** Modularity and SOLID are tools, not targets; match
  the codebase's existing level of abstraction rather than raising it. Architectural
  risks are flagged only — acting on one is a separate decision for the user.

### `skills/subagent-driven-development/SKILL.md` and `task-reviewer-prompt.md`

The plan is not the only place scope grows. Execution dispatches a reviewer per task
whose findings enter a five-round fix loop, so anything the reviewer can require, the
task must satisfy. Two openings there:

- **"The spec is a vision document"** tells the reviewer that behavior the task text
  is silent on is still a requirement, judged by what a reasonable person would
  expect. That is right for a crash on an unnamed input and wrong for a missing
  feature, and nothing distinguished the two. It is now bounded to findings with
  demonstrable harm — crash, data loss, corruption, security, silently wrong results.
  Anything else goes to "Declined to judge" for the controller to rule on.
- **Maintainability was a gating verdict.** Structural preferences — naming, file
  size, layering, duplication not yet causing a defect — could fail a task and pull
  it into the fix loop. They are now capped at Minor and reported rather than
  enforced, and restructuring existing code is explicitly out of scope for every
  task.

A rule was added at both levels: a finding that asks for work beyond the task's
requirements never enters the fix loop, whatever its severity. The loop makes a task
meet its brief; it does not extend the brief. Such findings are recorded in the plan's
Deferred section instead.

## What is deliberately not changed

Three further candidates were identified and left alone, because each trades against
something the upstream skills get right:

1. `brainstorming` step 6 ends *"Match the project's conventions unless there's a
   compelling reason to diverge"* — a loophole in practice, since compelling reasons
   are easy to find. Tightening it to require explicit user agreement would also block
   legitimate divergence.
2. The **Hard Gate** and its *"This Is Too Simple To Need A Design"* anti-pattern
   mandate a design document for changes as small as a config edit. Heavy, but it is
   the mechanism that stops implementation starting before requirements are settled.
3. The plan header has no **Non-goals** field. Adding one would give deferred items a
   home in the document's own contract.

`refactoring` was audited and left untouched. It already does this well — Phase 2
requires an explicit "what stays the same" contract, and it stops on scope growth
rather than absorbing it.

## Verifying it works

None of this is tested. The edits were made by reading the skill text, which tells
you the prompts now say something different — not that the model behaves differently.

`verify/` carries a fixed planning prompt and an A/B procedure: run the same request
against upstream skills and against this fork, and count unrequested tasks, behavior
changes, restructuring, unsolicited alternatives, and whether the Deferred section is
populated and correctly typed. `verify/README.md` also states what would falsify the
changes, including the outcome where nothing differs — which would mean the skill
text was not what drove the behavior.

The plugin's own harness (`tests/skill-triggering/`) tests whether a skill triggers,
not whether it restrains, and will not answer this.

## Relationship to upstream

These are general-purpose fixes, not local preferences, and the intent is to offer
them upstream. If REPOZY takes them, this fork should go away.

Upstream tracking:

```bash
git remote add upstream https://github.com/REPOZY/superpowers-optimized.git
gh repo sync <user>/<your-fork>
```

Changes are confined to two files, so upstream merges conflict only where the skill
text actually moved — which is the desired behavior, since it forces a re-read.
