---
name: changing-existing-behavior
description: >
  Use before planning or implementing any change that could reach a consumer outside
  the current codebase — another service, a client, a stored payload, a queue
  consumer, a published API response. Classifies the change and picks a rollout:
  additive, expand/contract, tristate flag, coordinated ship, or nothing. Triggers on:
  changing an endpoint's response, renaming or retyping a field, adding or tightening
  validation, changing auth or permission rules, changing a default, altering a
  computation other systems consume, deprecating anything. Not for internal-only
  refactors or new endpoints nothing consumes yet.
---

# Changing Existing Behavior

Existing working behavior stays unless changing it is the request.

## Inside vs outside

**Inside this codebase**, callers may be adjusted when the change requires it — the
compiler and the test suite cover you. Adjust the callers the change breaks, not the
ones you would have written differently.

**Outside this codebase** there is no safety net. Another service, a client, a stored
payload, a queue consumer, anything reading a published response — each is a contract.
Do not change one as a side effect, and do not assume you know every consumer. "I
checked and nothing calls it" is only true for things you can see.

## Classify, do not decide

Say which rung the change sits on and why. Mark the line `REQUIRES APPROVAL` and
**stop**. The user picks the rollout. Do not build a mechanism before they answer.

**1. Additive** — a new optional field, a new endpoint, a new enum value nothing
switches on exhaustively. Ship it. No mechanism.

**2. Contract shape change** — a field renamed, retyped, reordered, or given new
meaning. Version the interface where versioning is available. Where it is not, use
**expand/contract**: add the new field, populate old and new together, remove the old
only once consumers have moved. Never mutate a field in place.

**3. Behavior or policy change, consumers unknown** — new validation, stricter
parsing, auth or permission changes, rate limits, enforcing something previously
tolerated. **Tristate**: `off` / `logging` / `enforcing`. `logging` means evaluate the
new rule, record what it *would* have done, and serve the old result. It is a shadow
comparison, not a log statement — if it does not tell you who would have broken, it is
not doing its job.

**4. Behavior change, consumers known and reachable** — name them. Coordinate and
ship. Add a switch only if rollback must be faster than a deploy.

**5. Internal only** — no outside consumer. Nothing. Tests cover it.

## Why you stop before building

A tristate flag is three code paths, configuration, three test suites, a metric, and a
removal ticket. It is frequently larger than the change it protects, and it is
permanent surface until someone deletes it. Proposing one is a decision, not a
precaution — and a well-justified mechanism is harder to argue out of a plan than an
obviously unnecessary one.

Rung 1 and rung 5 are the common cases. Reach for 3 when you genuinely cannot
enumerate the consumers, not when enumerating them is inconvenient.

## Once a rung 2 or 3 mechanism is approved

**The safe state must be byte-identical to today.** For a tristate that is `off`; for
expand/contract it is a consumer reading only the old field. Prove it with a test
written against the current code **before** the change exists — a characterization
test asserting what the code does now, not what it should do. That test is the
behavior lock. The other states are ordinary feature tests.

Three tests, one of which matters:

- `off` / pre-migration → identical to today. **This is the lock.**
- `logging` → old result served, divergence recorded.
- `enforcing` / post-migration → new behavior.

**Removal is tracked before the mechanism ships.** A dual-path state is temporary by
definition, so the plan names the ticket that removes it and the code references that
ticket at the branch point. No ticket, no mechanism.

```java
// TODO(PROJ-1234): remove with the coupon-validation flag.
```

## How flags are wired

Flags are configuration, not code: a Helm value rendered into a ConfigMap and injected
as an attribute the service binds at startup. Never a constant, a build profile, or a
per-instance override.

```yaml
# values-prod.yaml — one entry per mechanism
features:
  couponValidation: logging     # off | logging | enforcing
```

Bind it as an enum with a safe default, not a string or a boolean. A tristate needs
three values, and a missing or misspelled value must land on `off`:

```java
public enum RolloutState { OFF, LOGGING, ENFORCING }

@ConfigurationProperties("features")
public record FeatureFlags(RolloutState couponValidation) {
    public FeatureFlags {
        // Absent or unbindable config fails safe, loudly.
        couponValidation = couponValidation == null ? RolloutState.OFF : couponValidation;
    }
}
```

Relaxed binding maps `FEATURES_COUPONVALIDATION` from the ConfigMap onto
`features.couponValidation`, so the Helm key and the Java property stay in step.

**Know what flipping actually costs.** Editing a ConfigMap does not restart anything.
Values injected as environment variables are read once at startup, so a flip is a
ConfigMap change plus `kubectl rollout restart` — minutes, and a rolling restart during
which both states are live at once. Mounted-volume config updates in place but Spring
will not re-read it without refresh wiring you probably do not have.

State the real number in the plan. Two consequences:

- **Both states run simultaneously during the rollout.** If old and new behavior cannot
  safely coexist for the length of a rolling restart, the flag does not solve your
  problem and something else is needed.
- **A flag is faster than a revert, not fast.** Config change plus restart beats
  revert-build-deploy, and that is the whole benefit. If rung 4 asked for a switch
  because rollback must be immediate, this does not deliver it — say so rather than
  letting the flag imply a speed it does not have.

**Per-environment progression lives in the values files**: `enforcing` in dev,
`logging` in staging and prod until the divergence metric is clean, then `enforcing` in
prod. The promotion is a values change, reviewed like any other.

## Observing divergence

`logging` is worthless without a signal you can aggregate. A log line per divergence
answers "did it happen"; you need "how often, and to whom", or you will never know
when it is safe to enforce.

**Emit a counter, not just a log.** One named metric per mechanism, with the outcome
as a label, so a single dashboard works in all three states:

```java
meterRegistry.counter("coupon.validation.shadow",
    "outcome", wouldReject ? "would_block" : "would_allow",
    "state",   flagState,          // off | logging | enforcing
    "caller",  callerId            // client or service identity
).increment();
```

- **Count both outcomes.** `would_allow` is not noise — without it you have no
  denominator and cannot state a rate.
- **Label with something that identifies the caller**: client id, service name, API
  key id. The question `logging` exists to answer is *who breaks when I enforce*, and
  a count with no caller dimension cannot answer it.
- **Watch cardinality.** Route template, not raw path. Client id, not user id. Never a
  request body, a token, or anything else that would put user data in a metric name or
  a label.
- **Log the detail separately**, at a level you can sample, for the cases you need to
  investigate. The metric tells you the shape; the log tells you the instance.

**State the exit criterion in the plan, as a number.** For example: `would_block`
stays at zero for 14 days across all callers, or the only remaining callers are ones
we have contacted. Without a stated threshold, "we watched it for a while" becomes the
criterion, and the flag stays in `logging` forever.

For your example — unauthenticated access on a URL about to be protected — the metric
is the whole point: it tells you how many requests, from which callers, would start
receiving 401s, and it is the difference between enforcing on evidence and enforcing
on hope.

## Reporting

In the plan or the proposal, one block:

```markdown
**External contract:** <what outside this codebase can observe this change>
**Rung:** <1-5> — <why>
**Mechanism:** <none | expand/contract | tristate | coordinated> — REQUIRES APPROVAL
**Behavior lock:** <the characterization test that proves the safe state is unchanged>
**Divergence signal:** <the metric name and its labels, and the exit criterion as a number — or n/a>
**Removal:** <the ticket that removes the mechanism — or n/a>
```

If you cannot fill in **External contract** with something concrete, the change is
probably rung 5 and none of this applies. Say so and move on.
