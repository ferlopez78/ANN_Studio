---
name: feature-slicer
description: Turn ANN Studio feature requests into small, implementation-ready vertical slices with clear boundaries, contracts, and acceptance checks.
license: MIT
---

Use this skill to avoid large risky implementations and convert requests into practical MVP slices.

When this skill should trigger:
- User asks to build a non-trivial feature.
- Scope spans UI + service + backend contracts.
- Team needs sequencing and risk control.

When this skill should NOT trigger:
- Bug fixes with obvious single-file resolution.
- Pure architecture brainstorming without delivery intent.

Workflow:
1. Identify user outcome and in-scope capabilities.
2. Define slice boundaries by module ownership.
3. Define slice contracts:
- UI inputs/outputs
- service/application interfaces
- API payload shape
- persistence implications
4. Define acceptance checks per slice.
5. Define dependency order and stop conditions.
6. Flag defer list explicitly (out of scope for current slice).

ANN Studio-specific checks:
- Keep slices aligned with OpenSpec flow and module map.
- Preserve reproducibility and lineage in every slice touching runs.
- Avoid hidden coupling between dataset/model/run/registry areas.
- Prefer frontend-first adapters only when backend is intentionally deferred.

Output format:
- Slice plan table (slice, scope, files/modules, contracts, acceptance).
- Risk list and mitigations.
- Recommended execution order.

If no active OpenSpec change exists for major work:
- Recommend creating/updating OpenSpec artifacts before implementation.
