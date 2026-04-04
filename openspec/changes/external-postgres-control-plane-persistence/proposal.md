## Why

ANN Studio needs full control-plane persistence in an external database to be deployable as a multi-tenant product on AWS.
Today, parts of the platform still rely on local browser state or in-memory backend state, which is not sufficient for:
- multi-user collaboration
- tenant isolation
- reproducible lineage queries
- operational durability across restarts/deployments

## Goals

- Persist all control-plane entities in external PostgreSQL.
- Enforce tenant isolation across all persisted entities.
- Use project-centric ownership for datasets and runs.
- Preserve lineage from dataset version + model definition + run + model registry artifact.
- Keep architecture backend-first and ready for AWS deployment.

## Scope

### In scope
- PostgreSQL persistence contracts for:
  - tenants, users, clients, projects
  - datasets and dataset versions
  - model definitions
  - runs and run events
  - metrics snapshots
  - model registry entries
  - audit events
- API contract updates to remove local-only source of truth.
- Migration strategy for moving local MVP state to PostgreSQL-backed workflows.

### Out of scope
- Billing/subscription contracts.
- Data warehouse/BI replica design.
- Full IAM/SSO provider-specific implementation.

## Impact

- Makes ANN Studio deployable in AWS with durable metadata.
- Enables true multi-tenant operation for multiple customer organizations.
- Establishes a single source of truth for orchestration and governance workflows.

## Open decisions

- Row Level Security policy in DB vs application-layer tenant filtering only.
- Hard delete policy for historical entities (default proposed: soft delete for business entities).
- Run event retention and archival horizon for large histories.
