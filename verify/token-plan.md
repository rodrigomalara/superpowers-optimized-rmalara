# Token reduction implementation

Approved scope: duplicate startup protection, compact router, reuse injected memory, bounded startup memory, bounded task route, and repeated hint suppression.

- [x] Add regression tests for byte budgets, lifecycle duplication, compaction reset, explicit requests and project/session isolation; run them red.
- [x] Share startup budget and lifecycle helpers across shell and Codex entry points. Preserve envelopes and fail open when session identity/storage is unavailable.
- [x] Suppress consecutive identical hints in both prompt adapters; reset after lifecycle events and preserve explicit skill requests.
- [x] Update routing and state-writing guidance; retain full workflow for uncertain requirements and shared contracts.
- [x] Run all local hook suites and shell syntax checks; inspect diff. No commits or installed configuration changes.

Exclusions: old installed versions do not cooperate with the new duplicate guard. Memory truncation does not summarize omitted sections. Hint suppression cannot infer every natural-language task boundary.

Verification: 9 Codex hook suites, 109 compression checks, 3 workflow script suites, shell syntax, and git diff --check passed. Agent behavior and token billing were not benchmarked. Installed plugin copies and user configuration were not changed.
