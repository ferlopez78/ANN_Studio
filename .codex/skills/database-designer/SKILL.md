---
name: database-designer
description: Design ANN Studio metadata schemas and storage contracts for PostgreSQL-first control-plane data, lineage, and run reproducibility.
license: MIT
---

Use this skill to design metadata models and persistence contracts. Focus on product metadata, lineage, and state transitions, not training tensor storage.

When this skill should trigger:
- User asks for schema/table/entity design.
- A feature introduces new persistent metadata fields.
- Run lineage, dataset versioning, or model registry links are being defined.
- Query patterns for dashboard, runs, or registry are unclear.

When this skill should NOT trigger:
- Cosmetic UI changes.
- In-memory local prototypes with no persistence decisions.
- Training algorithm implementation details unrelated to metadata.

Workflow:
1. Collect required entities and lifecycle states from OpenSpec.
2. Define canonical identifiers and foreign-key relationships.
3. Separate mutable operational state from immutable historical snapshots.
4. Define write ownership per module.
5. Define required indexes from query paths (dashboard cards, recent runs, registry filters, lineage drill-down).
6. Define constraints and invariants:
- completed-run-only registration
- immutable dataset version references
- valid state transition guards
7. Define migration strategy and backward compatibility notes.

Mandatory ANN Studio checks:
- Control plane is canonical for run IDs and run state.
- Training outputs are referenced as artifact URIs, not duplicated blobs in metadata tables.
- Lineage links must be explicit and immutable once created.
- Security-sensitive fields must not be stored in plaintext.

Output format:
- Entity list with purpose
- Key fields and data types
- Relationship map
- Constraints/invariants
- Query and index plan
- Migration notes

Implementation note:
- If current implementation is frontend-first, still produce backend-ready contracts so local stores map cleanly to future PostgreSQL schemas.
