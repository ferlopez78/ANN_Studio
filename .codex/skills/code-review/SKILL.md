---
name: code-review
description: Perform high-signal ANN Studio code reviews focused on defects, architecture regressions, contract drift, and missing verification.
license: MIT
---

Use this skill for review requests and pre-merge quality checks.

When this skill should trigger:
- User asks for a review or audit.
- A change spans multiple modules or introduces new contracts.
- There is risk to reproducibility, lineage, or run-state correctness.

When this skill should NOT trigger:
- User asks for implementation directly without review.
- Tiny isolated typo/style edits with no behavior impact.

Review priorities (in order):
1. Functional correctness and regression risk.
2. Contract consistency (OpenSpec, API payloads, state machine semantics).
3. Architecture/layering violations.
4. Data integrity and lineage/reproducibility risk.
5. Security and unsafe logging of sensitive data.
6. Test gaps and missing verification evidence.

ANN Studio-specific checks:
- Control-plane and training-plane boundaries are respected.
- Run state transitions are valid and terminal semantics are preserved.
- Model registration rules (completed run only) are enforced.
- Dataset/model/run lineage links remain intact.
- UI modules do not absorb low-level persistence/network details.

Output format:
- Findings first, sorted by severity.
- For each finding: impact, location, and actionable fix.
- Open questions/assumptions.
- Residual risks and test gaps.

If no findings:
- State explicitly that no defects were found.
- Still report residual risk and testing gaps.
