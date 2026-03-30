## Context

ANN Studio is defined as a web platform to design, configure, train, monitor, and manage neural-network models. The MVP must support tabular and computer-vision workflows while remaining practical for local developer machines.

This change specifies architecture and module contracts only. It intentionally avoids generating application code or scaffolding frontend or backend services.

## Architecture Overview

ANN Studio MVP uses a two-plane architecture:

- Control plane: Web APIs and orchestration services responsible for dataset lifecycle, model configuration, run lifecycle, metrics aggregation, and model registry.
- Training plane: Executable training workers that consume run plans, access datasets and artifacts, execute model training, and emit metrics and checkpoints.

Data and tracking infrastructure:

- PostgreSQL stores product metadata and lineage relationships.
- Object storage stores dataset payloads, dataset snapshots, checkpoints, and trained model artifacts.
- MLflow tracks experiment runs, scalar metrics, and training artifacts and is linked to control-plane run records.

Deployment and runtime model:

- Docker-first local development environment.
- Intended to run on developer machines first, with clear service boundaries for future scale-out.

## Goals / Non-Goals

**Goals:**
- Define production-oriented module boundaries and contracts for MVP capabilities.
- Guarantee reproducibility through immutable run metadata and lineage across dataset version, configuration, and model artifact.
- Support both tabular and CV model families within a shared orchestration surface.
- Ensure metrics visibility during training and diagnostics for quality issues.

**Non-Goals:**
- Implementing source code, UI components, or API endpoints in this change.
- Cluster scheduling and distributed autoscaling.
- Enterprise multi-tenant policy management.
- Any AGPL-licensed implementation dependency for model training.

## Main Domains and Modules

1. Workspace Security Module
- Scope: authentication baseline, authorization hooks, secret management policy, and audit event recording.
- Responsibilities: enforce access boundaries to sensitive actions and data references.

2. Dataset Management Module
- Scope: tabular and CV dataset registration, metadata management, versioning, split templates, and run-bound dataset resolution.
- Responsibilities: immutable dataset versions and validated split assignments.

3. Model Design Module
- Scope: model family templates and configuration schema for tabular ANN and in-house one-stage detector.
- Responsibilities: validated model definitions and compatibility checks between model family and dataset type.

4. Run Orchestration Module
- Scope: run creation, queueing, launching, status transitions, checkpoint policy, and reproducibility metadata capture.
- Responsibilities: deterministic run records and control-plane to training-plane handoff.

5. Metrics and Diagnostics Module
- Scope: real-time metric ingestion, train-validation curve generation, classification and detection metric surfaces, and heuristic diagnostics.
- Responsibilities: expose actionable live feedback and post-run summaries.

6. Model Registry Module
- Scope: model registration, version catalog, governance metadata, and lineage traversal.
- Responsibilities: controlled promotion from run artifacts to registered model versions.

## Key Entities

- Workspace: logical boundary for users, projects, and security context.
- Dataset: logical dataset identity with type (tabular or CV) and metadata.
- DatasetVersion: immutable dataset snapshot with schema summary and storage URI.
- SplitConfig: train-validation-test split policy linked to DatasetVersion.
- ModelDefinition: model family and architecture configuration payload.
- TrainingConfig: hyperparameters and runtime knobs for a run.
- Run: orchestrated training execution instance with immutable run ID.
- RunArtifact: checkpoint or output artifact associated with a run.
- MetricStream: time-series metric events for training and validation.
- DiagnosticSignal: derived signal indicating likely underfitting or overfitting.
- ModelVersion: registered model entity linked to run, artifacts, and dataset lineage.

## Boundaries Between Modules

- Dataset Management owns dataset metadata, versions, and split policies; Run Orchestration consumes resolved dataset version references and cannot mutate dataset state.
- Model Design owns model family constraints and config validation; Run Orchestration consumes validated ModelDefinition and TrainingConfig snapshots.
- Run Orchestration owns run lifecycle state transitions; Metrics and Diagnostics can append metrics and diagnostics but cannot alter run identity or config snapshots.
- Model Registry consumes completed run outputs and lineage references; it cannot register models from non-terminal or failed runs.
- Workspace Security policies apply cross-cutting controls across all modules and records audit events for privileged operations.

## Technology Choices

- Containerization: Docker and Docker Compose for local-first, reproducible development runtime.
- Metadata store: PostgreSQL for transactional consistency and relational lineage queries.
- Artifact and dataset storage: object storage abstraction for dataset payloads, checkpoints, and model artifacts.
- Experiment tracking: MLflow for experiment metadata, metric timelines, and artifact linkage.
- Communication pattern: control-plane APIs trigger run plans; training plane reports status and metrics through explicit contracts.

## Non-Functional Requirements

- Reproducibility: each run MUST persist immutable references to dataset version, model definition, and training config snapshot.
- Auditability: privileged operations (dataset registration, run launch, model registration) MUST emit audit events.
- Observability: metric ingestion latency and run status updates MUST support near-real-time UX expectations during active training.
- Reliability: failed training jobs MUST be represented as explicit terminal states with diagnostic payloads.
- Security baseline: secrets MUST not be persisted in plain text in metadata stores or logs.
- Portability: local deployment MUST be executable through documented Docker-first workflows.

## Risks / Trade-offs

- Local-first environment may mask issues that appear in distributed execution.
	- Mitigation: enforce clear service contracts and avoid local-only coupling patterns.
- Mixing tabular and CV support in one MVP increases schema and validation complexity.
	- Mitigation: keep dataset and model family validation strict and explicit by type.
- MLflow plus internal metadata can cause duplication of run information.
	- Mitigation: define source of truth rules and store cross-references rather than duplicate payloads.
- Heuristic diagnostics can produce false positives for underfitting or overfitting.
	- Mitigation: mark diagnostics as advisory and expose underlying metric evidence.

## Open Questions

- Which object storage backend is preferred for local developer machines by default?
- Should run orchestration include retry policies in MVP or defer retries to post-MVP?
- What minimum metric refresh interval is acceptable for live curves in local environments?
