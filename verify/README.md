# Verifying the scope patches

Nothing here has been tested. The edits were made by reading the skill text, which
tells you the prompts say something different — not that the model behaves
differently. This is the cheapest way to find out.

The plugin's own harness (`tests/skill-triggering/run-test.sh`) needs an
authenticated `claude` CLI and tests whether a skill *triggers*, not whether it
*restrains*. It will not answer this question. Run the A/B below instead.

## The A/B

`prompt.txt` is a feature request against a codebase with an obvious refactor
temptation and an obvious "better approach" temptation. Run it twice.

```bash
# A — before: upstream skills
# in ~/.claude/settings.json enabledPlugins:
#   "superpowers-optimized@superpowers-optimized": true
#   your fork: false
claude -p "$(cat prompt.txt)" --max-turns 12 > run-A.md

# B — after: your fork
# flip the two flags, restart the session
claude -p "$(cat prompt.txt)" --max-turns 12 > run-B.md
```

Run each two or three times. These models vary between runs, and a single pair of
outputs will mislead you in whichever direction you are hoping for.

## What to count

Score each run on five things. Counting beats impressions.

1. **Unrequested tasks.** Tasks in the plan that no line of the request asks for.
2. **Behavior changes.** Steps that alter existing observable behavior — signatures,
   response shapes, error text, schema.
3. **Restructuring.** File splits, moves, renames of existing code.
4. **Alternatives offered.** The request names an approach. Does the plan argue for a
   different one?
5. **Deferred section.** Present? Bugs and cut changes only? Any entry marked
   `verified` that the model could not have verified?

B should score lower on 1-4 and produce a populated, correctly-typed 5.

## What would falsify the patches

Worth deciding before you look, so you are not grading your own work:

- **No difference in 1-4.** The skill text was not what was driving the behavior, and
  the real cause is elsewhere — most likely the base model, or your own prompt
  phrasing. Revert and look somewhere else.
- **B refuses work that was actually requested.** Over-correction. The expansion scan
  is too aggressive and is cutting tasks that do cite a requirement.
- **Deferred fills with noise.** Every run produces six entries of `suspected`
  nothing-in-particular. The two categories are too loose; tighten `scope-creep` to
  cut changes that would alter behavior, and drop the rest.
- **B's plans get longer.** The scans added process without removing content. Check
  whether the Proportion step (upstream's step 6) is still firing.

## Cheaper signal, no harness

If the A/B is more work than it is worth: for the next five real plans you generate,
just count items 1-3 by hand and keep the numbers in a file. Slower, but it measures
the thing you actually care about on work you were doing anyway, and it cannot be
gamed by a prompt written to make the patches look good.
