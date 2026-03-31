## Why

ANN Studio needs a concrete MVP contract that teams can implement without ambiguity.
Today, requirements are known at a high level but delivery risk remains in three areas:

- unclear boundary between control plane and training plane responsibilities
- incomplete traceability rules for reproducibility and model governance
- no shared implementation sequence across product, backend, ML, and UI work

This change defines an implementation-ready MVP blueprint so execution can start with explicit scope, measurable acceptance criteria, and clear architectural constraints.

## Goals

- Define ANN Studio as a web product control plane for datasets, model design, run operations, diagnostics, and registry workflows.
- Preserve strict reproducibility through immutable lineage from dataset version and run config to artifacts and model versions.
- Support tabular ANN classification and in-house one-stage detector flows in one unified product surface.
- Provide a dashboard-first operating experience for technical and business users.
- Establish a local-first runtime that is reliable on developer machines and extensible later.

## MVP Scope

### Included in MVP
- Workspace security baseline for authenticated access, operation-level authorization, redaction, and audit events.
- Dataset management for tabular and CV datasets with immutable versioning and split configuration.
- Model design contracts for tabular ANN binary, tabular ANN multiclass, and in-house one-stage detector.
- Run orchestration with immutable run identity, run lifecycle state machine, launch handoff, checkpoints, and run comparison.
- Metrics and diagnostics with near-real-time curves, model-family metric surfaces, and advisory overfitting and underfitting signals.
- Model registry with registration from completed runs only and full lineage links.
- Dashboard-level UX contract that prioritizes KPI visibility, recent runs, alerts, and quick actions.

### Deferred from MVP
- Distributed scheduling and autoscaling orchestration.
- Enterprise identity providers and advanced multi-tenant policy controls.
- Inference serving workspace and endpoint lifecycle management.
- Automated model promotion pipelines across environments.
- Dark mode and advanced theming.

## Capability Coverage in This Change

### Added capability deltas
- workspace-security
- dataset-management
- model-design
- run-orchestration
- metrics-diagnostics
- model-registry

### Explicitly deferred capability deltas
- app-bootstrap
- experiment-registry
- inference-workspace
- training-workflows

Deferred capabilities remain as placeholders and will be addressed in follow-up OpenSpec changes.

## Business and Technical Rationale

- Business: leadership and delivery teams need one credible operational product narrative, not separate ad hoc tools.
- Product: the dashboard-first layout supports daily operational decisions and demo-readiness.
- Technical: explicit contracts reduce integration drift between UI, backend services, training workers, and tracking systems.
- Compliance: non-AGPL policy remains explicit for the in-house detector path.

## Success Criteria

This change is considered ready for implementation when:

- proposal, design, and tasks are internally consistent
- all in-scope capability deltas are complete and testable
- deferred capabilities are explicitly listed and not implied as in-scope
- cross-cutting reproducibility and security constraints are mapped to validation tasks

## Impact

- Affects OpenSpec artifacts under openspec/changes/bootstrap-ann-studio-mvp.
- Provides the source-of-truth plan for MVP implementation sequencing.
- Enables execution in vertical slices without changing architecture boundaries.

## Open Decisions

- Which local object storage backend will be the default for developer setup?
- What is the MVP target for live metric refresh interval under local runtime constraints?
- Should run retry policy be included in MVP or deferred?
