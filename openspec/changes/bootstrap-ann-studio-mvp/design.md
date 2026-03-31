## Context

ANN Studio is an operations product for designing, running, monitoring, and governing neural-network workflows.
The MVP must be credible for daily usage and leadership demos while remaining feasible on local developer machines.

This design defines architecture and delivery contracts for implementation readiness.

## Design Objectives

- Keep strict separation between control plane and training plane.
- Guarantee reproducibility and lineage as non-negotiable product behavior.
- Support both tabular and CV paths in one orchestration surface.
- Deliver a dashboard-first UI that reflects operational status clearly.
- Keep the runtime local-first with explicit upgrade path to larger deployments.

## System Architecture

ANN Studio MVP uses two execution planes and shared data infrastructure.

### Control plane
- Owns product APIs, orchestration logic, validation, metadata persistence, audit events, and dashboard query surfaces.
- Is the source of truth for run identity, run state, lineage references, and policy checks.

### Training plane
- Executes training jobs from immutable run plans.
- Writes artifacts and checkpoints to object storage.
- Emits status and metric events back to control-plane contracts.

### Shared infrastructure
- PostgreSQL for transactional metadata and lineage queries.
- Object storage for dataset payloads, checkpoints, and model artifacts.
- MLflow for experiment metrics and artifact tracking, linked by control-plane run IDs.

## Product Operating Flows

### Flow 1: Dataset to run launch
1. User registers dataset and creates immutable dataset version.
2. User defines split configuration for that version.
3. User selects model definition and training configuration.
4. Control plane validates compatibility and creates run plan.
5. Training plane receives run plan and starts execution.

### Flow 2: Live run monitoring
1. Training plane emits status and metrics periodically.
2. Control plane persists event stream and derived diagnostics.
3. Dashboard surfaces recent runs, KPI updates, and alerts.

### Flow 3: Model registration
1. User selects completed run output.
2. Control plane enforces completed-run-only policy.
3. Model registry stores model version metadata and lineage links.

### Flow 4: Reproducibility inspection
1. User opens historical run or model version.
2. System returns immutable references to dataset version, model definition, config snapshot, and artifacts.

## Domain Modules

1. Workspace Security
- Authentication and authorization baseline.
- Audit events and secret redaction policy.

2. Dataset Management
- Dataset identity, metadata, versions, split policy.
- Validation by dataset type.

3. Model Design
- Model-family templates and config schema.
- Non-AGPL guardrails for detector path.

4. Run Orchestration
- Run creation, lifecycle transitions, launch handoff.
- Checkpoint policy and reproducibility snapshot.

5. Metrics and Diagnostics
- Near-real-time curve ingestion and aggregation.
- Advisory underfitting and overfitting diagnostics.

6. Model Registry
- Model registration from completed runs only.
- Query and lineage traversal.

## Data and Ownership Boundaries

- Dataset Management owns Dataset and DatasetVersion write paths.
- Model Design owns ModelDefinition and TrainingConfig schema validation.
- Run Orchestration owns Run state machine and immutable run snapshots.
- Metrics and Diagnostics owns MetricStream and DiagnosticSignal append operations.
- Model Registry owns ModelVersion metadata but consumes immutable upstream lineage references.
- Workspace Security is cross-cutting and records audit outcomes for privileged operations.

No module can mutate another module's immutable historical records.

## Dashboard Information Contract

The home dashboard must support these information blocks for MVP:

- KPI cards: running jobs, recent completion success, dataset readiness, registry candidates.
- Recent runs panel: run identity, project, model family, status, progress, updated timestamp.
- Alerts panel: open operational issues requiring action.
- Quick actions panel: launch run, import dataset, create model config, register candidate.

This contract aligns UI behavior to backend query surfaces without forcing component-level implementation details in this spec.

## Non-Functional Requirements

- Reproducibility: every run persists immutable references to dataset version, model definition, and training config snapshot.
- Auditability: privileged operations produce audit records with actor, action, resource, outcome, and timestamp.
- Security: secrets are redacted in logs and never persisted in plaintext metadata fields.
- Reliability: failed runs are terminal and include failure diagnostics.
- Observability: active run status and metric updates are near-real-time for dashboard UX.
- Portability: local deployment is executable through Docker-first workflow.
- Maintainability: implementation MUST avoid monolithic files and spaghetti patterns by using modular, cohesive units.
- Structural consistency: codebase MUST use feature-first folder organization and explicit separation of concerns.
- Layering: frontend and backend MUST separate presentation, application/service logic, domain logic, and infrastructure concerns into distinct modules/files.

## MVP v1 Code Organization Standard

The MVP implementation MUST use the following feature-first structure patterns.

### Frontend standard

- apps/web/src/app
	- shell and top-level routing/composition
- apps/web/src/shared
	- reusable UI primitives, common hooks, utilities, and API client plumbing
- apps/web/src/features/dashboard
	- ui
	- services
	- types
- apps/web/src/features/datasets
	- ui
	- services
	- types
- apps/web/src/features/runs
	- ui
	- services
	- types
- apps/web/src/features/model-registry
	- ui
	- services
	- types
- apps/web/src/features/metrics
	- ui
	- services
	- types

Frontend implementation rules:

- Feature UI files MUST not contain low-level persistence or network client details.
- Shared utilities MUST be generic and reusable across features.
- Feature modules MUST expose clear public entry points through index files.
- No single frontend file should accumulate unrelated feature logic.

### Backend standard

- apps/api/src/app
	- application bootstrap and dependency wiring
- apps/api/src/shared
	- common config, logging, error handling, and infrastructure abstractions
- apps/api/src/features/workspace-security
	- presentation
	- application
	- domain
	- infrastructure
- apps/api/src/features/dataset-management
	- presentation
	- application
	- domain
	- infrastructure
- apps/api/src/features/model-design
	- presentation
	- application
	- domain
	- infrastructure
- apps/api/src/features/run-orchestration
	- presentation
	- application
	- domain
	- infrastructure
- apps/api/src/features/metrics-diagnostics
	- presentation
	- application
	- domain
	- infrastructure
- apps/api/src/features/model-registry
	- presentation
	- application
	- domain
	- infrastructure

Backend implementation rules:

- Presentation layer handles transport concerns only.
- Application layer orchestrates use cases and transactions.
- Domain layer owns core business rules and invariants.
- Infrastructure layer implements repositories, storage adapters, and external integrations.
- Cross-feature dependencies MUST go through application contracts, not direct infrastructure coupling.

## Delivery Strategy

Implementation should proceed in vertical slices:

1. Slice A: Dataset and model definition contracts end-to-end validation.
2. Slice B: Run launch and lifecycle tracking with basic checkpoint references.
3. Slice C: Live metrics and diagnostics visible in dashboard blocks.
4. Slice D: Model registration and lineage traversal.
5. Slice E: security hardening and cross-cutting verification.

Each slice must preserve architecture boundaries and produce testable acceptance outputs.

## Risks and Mitigations

- Risk: dual support for tabular and CV increases validation complexity.
- Mitigation: strict type-specific schemas and compatibility checks before run creation.

- Risk: duplicated run data between internal metadata and MLflow.
- Mitigation: internal run ID as canonical key; MLflow referenced by cross-link, not duplicated.

- Risk: advisory diagnostics can create false positives.
- Mitigation: include supporting metric evidence in every diagnostic payload.

- Risk: local-first runtime may hide distributed system issues.
- Mitigation: preserve explicit contracts and avoid local-only shortcuts in interfaces.

## Open Decisions

- Default local object storage backend.
- Retry behavior for failed runs in MVP.
- Metric refresh target and acceptable latency under local constraints.
- Minimum dashboard SLA for run-state freshness.
