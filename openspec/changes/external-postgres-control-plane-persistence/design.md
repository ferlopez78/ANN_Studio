## Context

This change defines the target external PostgreSQL persistence architecture for all ANN Studio control-plane metadata.
The design assumes AWS deployment (for example RDS PostgreSQL), backend-first orchestration, and strict tenant isolation.

## Design Objectives

- Single durable source of truth for all control-plane entities.
- Explicit tenant and project ownership on all major records.
- Immutable lineage links for reproducibility.
- Event-oriented run tracking for diagnostics and auditability.

## Canonical Ownership Hierarchy

1. tenant
2. user
3. client
4. project
5. dataset + dataset_version
6. model_definition
7. run + run_event + run_metric
8. registry_model + registry_model_version

## PostgreSQL Entity Set

Core entities:
- tenants
- users
- clients
- projects

Dataset entities:
- datasets
- dataset_versions
- dataset_ingestion_snapshots

Model design entities:
- model_definitions
- model_definition_versions

Run orchestration entities:
- runs
- run_events
- run_metric_points
- run_artifacts

Model registry entities:
- registry_models
- registry_model_versions

Security and operations:
- audit_events

## Required Cross-Entity Invariants

- Every persisted entity (except tenant) MUST include tenant_id.
- datasets, model_definitions, and runs MUST include project_id.
- project_id MUST belong to same tenant_id.
- run MUST reference immutable dataset_version_id and model_definition_version_id.
- registry_model_version MUST reference source_run_id in completed status.

## Multi-Tenant Isolation Strategy

- API derives tenant_id from authenticated identity context.
- API never accepts tenant_id from client payload.
- Every query and mutation includes tenant_id filter.
- Cross-tenant access returns not found without existence leakage.

## API Evolution Rules

- Replace browser-only persistence flows with backend API source-of-truth reads/writes.
- Keep request/response IDs stable and opaque (UUID).
- Enforce optimistic update semantics via updated_at_utc checks where relevant.

## AWS Deployment Direction

- External DB: PostgreSQL-compatible managed service.
- DB config via env vars:
  - DATABASE_URL
  - DB_POOL_MIN
  - DB_POOL_MAX
  - DB_SSL_MODE
- Migrations managed by backend deployment pipeline.

## Phased Implementation Plan

Phase 1 (current in progress):
- clients/projects persistence and API.

Phase 2:
- datasets + dataset versions + ingestion snapshots persistence.

Phase 3:
- model definitions persistence and versioning.

Phase 4:
- runs + run events + metrics points + artifacts metadata.

Phase 5:
- model registry persistence bound to completed runs.

Phase 6:
- end-to-end lineage and audit query endpoints.

## Risks and Mitigations

Risk: inconsistent tenant filtering across modules.
Mitigation: shared repository helpers + integration tests for cross-tenant denial.

Risk: run metric cardinality growth.
Mitigation: partitioning/retention policy for run_metric_points.

Risk: migration drift across environments.
Mitigation: versioned SQL migrations + startup health/migration checks.
