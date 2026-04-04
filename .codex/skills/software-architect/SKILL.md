---
name: software-architect
description: Design or refactor ANN Studio architecture boundaries and module structure. Use when work affects multiple modules, ownership boundaries, layering, or control-plane versus training-plane responsibilities.
license: MIT
---

Use this skill to make architecture decisions that stay aligned with AGENTS.md and OpenSpec design contracts.

When this skill should trigger:
- User asks for architecture design, refactor, or module boundaries.
- A change touches more than one domain area (dataset-management, model-design, run-orchestration, metrics-diagnostics, model-registry, workspace-security).
- There is risk of coupling UI, application, domain, and infrastructure concerns.
- Control-plane and training-plane responsibilities are unclear.

When this skill should NOT trigger:
- Small single-file bug fixes.
- Pure UI styling adjustments with no architecture impact.
- Simple endpoint bug fixes where contracts and boundaries are already defined.

Workflow:
1. Read current OpenSpec artifacts first (proposal/design/tasks and affected delta specs).
2. Map the change to ANN Studio domains and ownership.
3. Produce explicit boundaries:
- which module owns writes
- which modules consume read-only references
- immutable records that must never be mutated
4. Define layering for each touched module:
- presentation
- application/service
- domain
- infrastructure
5. Define integration contracts between modules (inputs, outputs, IDs, error semantics).
6. Flag architecture risks:
- hidden coupling
- monolith growth
- duplicated source of truth
- reproducibility breaks
7. Propose implementation slices that preserve boundaries.

Mandatory ANN Studio checks:
- Preserve control-plane source of truth for run identity/state.
- Preserve reproducibility lineage from dataset version + config + run + model version.
- Do not bypass module ownership with direct infrastructure coupling.
- Keep code feature-first and avoid dumping logic in app shell/store/UI files.

Output format:
- Decision summary
- Ownership matrix
- Layering map per affected module
- Integration contracts
- Risks and mitigations
- Recommended implementation slices

If architecture change is non-trivial and no active OpenSpec change exists:
- Recommend creating or updating an OpenSpec change before implementation.
