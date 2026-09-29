# About this fork

A fork of [REPOZY/superpowers-optimized](https://github.com/REPOZY/superpowers-optimized),
itself a fork of Jesse Vincent's [superpowers](https://github.com/obra/superpowers-marketplace).
MIT licensed, same as upstream. Forked at v6.8.1 (`38e85b9`).

It changes two skills — `writing-plans` and `brainstorming` — to remove structural
pressure toward scope creep in implementation plans. Everything else is upstream.

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
- **A `## Deferred (not proposed)` section** collects whatever the scans remove. This
  matters: without somewhere to put a better idea, it leaks back into the plan. The
  idea gets recorded rather than silently adopted or silently lost.
- **The file-split license is removed.** Splits route to Deferred, and from there to
  `refactoring`, which locks behavior with tests first.

### `skills/brainstorming/SKILL.md`

- **Alternatives are conditional.** Propose 2-3 approaches when the user has not
  specified one. When they have, evaluate that approach — state what it costs and
  where it breaks — and design against it unless it cannot meet the requirements. An
  approach the model prefers but was not asked for goes to non-goals, named once.
- **Engineering Rigor reframed.** Modularity and SOLID are tools, not targets; match
  the codebase's existing level of abstraction rather than raising it. Architectural
  risks are flagged only — acting on one is a separate decision for the user.

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
