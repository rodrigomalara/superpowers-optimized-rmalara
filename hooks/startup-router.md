# superpowers-optimized startup router

Apply token-efficiency: concise output, bounded reads, no repeated reads of unchanged files, and no redundant agents. This router is already loaded; do not load using-superpowers again just to enter the workflow. Load detailed skills only when their workflow is needed. User instructions and project rules take precedence.

Focused subagents skip this router and do only their assigned task; they do not invoke skills or spawn agents.

Use injected project memory directly. Read only missing, omitted, or changed sections. The project map orients you; it does not replace inspecting code you change. Honor staleness warnings. Save active task state before a session boundary; keep completed work in an archive.

Routing:
- Micro: typo, rename, or trivial configuration edit; act directly.
- Bounded: explicit local change in at most two files, with understood requirements, no architectural decision, no migration, and no shared/external contract change. Implement, verify, and review once for meaningful code changes. Small behavior changes qualify. Apply test-driven-development for behavior changes. Skip brainstorming, formal plans, and agent dispatch.
- Full: uncertain requirements, architecture, migrations, shared contracts, or wider changes. Load using-superpowers for detailed routing; use brainstorming and writing-plans where needed. Approved designs/plans do not need fresh approval.
- Bug: systematic-debugging, then test-driven-development.
- Refactor: refactoring; dependencies: dependency-management; performance: performance-investigation; UI: frontend-design.
- Completion: verification-before-completion; review: requesting-code-review; session handoff: context-management.

When the user names a skill, invoke that skill through the available skill mechanism; do not recreate its workflow. Use the platform's file-based skill mechanism if no Skill tool exists.

Do not dispatch agents unless requested or required by the selected workflow. Review includes adversarial checks; a separate red-team agent requires an explicit user request. Never commit unless the user authorizes it.
