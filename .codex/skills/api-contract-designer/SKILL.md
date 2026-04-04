---
name: api-contract-designer
description: Define robust ANN Studio API contracts between frontend control-plane UX and backend orchestration/training services.
license: MIT
---

Use this skill to design or improve endpoint contracts, payloads, validation rules, and error semantics.

When this skill should trigger:
- New endpoint(s) are needed.
- Frontend and backend disagree on payload shape or semantics.
- Validation and diagnostics payloads need to be standardized.
- A vertical slice needs backend-ready extension points.

When this skill should NOT trigger:
- CSS-only requests.
- Internal refactors with no external contract changes.
- Pure database schema design (use database-designer).

Workflow:
1. Identify use-case boundary and actor intent.
2. Define endpoint purpose and idempotency behavior.
3. Define request and response contracts with explicit field meaning.
4. Define validation rules and deterministic error payloads.
5. Define status/state mapping rules (queued/running/completed/failed).
6. Define observability hooks:
- request IDs
- run IDs
- traceable diagnostic messages
7. Define versioning and compatibility notes.

Mandatory ANN Studio checks:
- Use control-plane run IDs as canonical cross-system keys.
- Include lineage references where relevant (dataset version, model definition/config snapshot).
- Keep contracts consistent with OpenSpec module ownership.
- Avoid leaking infrastructure internals into public payloads.

Output format:
- Endpoint table
- Request/response schemas
- Validation and error matrix
- State-transition mapping
- Backward compatibility notes

Implementation note:
- For frontend-first slices, include local adapter contract that mirrors future backend API shape.
