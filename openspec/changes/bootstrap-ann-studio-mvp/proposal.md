## Why

Teams building neural-network solutions need a single platform that standardizes dataset lifecycle, model configuration, training execution, and model governance. ANN Studio currently lacks a formal product contract for those workflows, which creates ambiguity in implementation, slows delivery, and increases risk of non-reproducible training outcomes.

Defining a clear MVP change now enables implementation to proceed in phases with explicit requirements, testable scenarios, and architectural boundaries that fit local developer machines while preserving a path to future scale.

## Goals

- Establish ANN Studio as a web-based control plane for creating and managing neural-network training runs.
- Support both tabular and computer-vision dataset workflows with versioned metadata and run-bound dataset selection.
- Define model family requirements for tabular ANN classifiers and an in-house one-stage detector implementation.
- Ensure reproducibility through lineage from dataset version and training configuration to run outputs and registered models.
- Provide real-time training diagnostics and actionable heuristics for likely underfitting and overfitting.

## MVP Scope

- Dataset management for tabular and computer vision datasets, including metadata, versioning, configurable train-validation-test splits, and run-specific dataset selection.
- Model design for:
	- Tabular ANN binary classification.
	- Tabular ANN multiclass classification.
	- Custom one-stage object detector implemented in-house with no dependency on AGPL implementation code.
- Training configuration with explicit controls for hidden layers, activations, dropout, batch normalization, optimizer, learning rate, scheduler, regularization, early stopping, batch size, epochs, seed, loss function, and evaluation metrics.
- Run orchestration for creating and launching runs, tracking status, checkpoint persistence, run comparison, and reproducibility metadata.
- Live metrics and diagnostics including train and validation curves, classification metrics for tabular models, detection metrics for CV models, and heuristics for likely underfitting and overfitting.
- Model management through model registration, model metadata, and lineage to dataset version, configuration, and training run.

## Out of Scope

- Production cluster deployment, autoscaling, or multi-region infrastructure.
- Enterprise IAM integration and multi-tenant authorization policy.
- Automated CI-CD release pipelines for model promotion.
- Third-party AGPL code or AGPL-derived implementation assets.
- Building the application source code in this change.

## What Changes

- Add new OpenSpec capability specs for workspace security, dataset management, model design, run orchestration, metrics diagnostics, and model registry.
- Define architecture constraints and module boundaries for control plane and training plane separation.
- Define technical decisions for Docker-first local development, PostgreSQL metadata persistence, object storage for datasets and artifacts, and MLflow tracking integration.
- Define phased and verifiable implementation tasks without generating backend or frontend scaffolding.

## Capabilities

### New Capabilities
- `workspace-security`: Baseline security controls for workspace access, secrets handling, and auditability in a local-first environment.
- `dataset-management`: Dataset ingestion, metadata, versioning, split configuration, and run-bound dataset selection.
- `model-design`: Supported model families and configuration surface for tabular ANN and in-house one-stage detector.
- `run-orchestration`: Run creation, launch, status lifecycle, checkpoints, comparisons, and reproducibility metadata.
- `metrics-diagnostics`: Real-time metrics streams, model-family-specific evaluation outputs, and training quality heuristics.
- `model-registry`: Model registration, metadata, and lineage from run and dataset version to deployable artifact.

### Modified Capabilities
- None.

## Business and Technical Rationale

- Business rationale: A unified MVP reduces time-to-experiment and improves confidence in model outcomes by making run tracking and lineage first-class product features.
- Technical rationale: Early specification of architecture, entities, and interfaces lowers integration risk across data, training, and governance workflows.
- Compliance rationale: Explicit exclusion of AGPL implementation dependencies prevents downstream licensing conflicts for commercial adoption.

## Impact

- Affects only OpenSpec artifacts under openspec/changes/bootstrap-ann-studio-mvp.
- Establishes requirements baseline for future backend and frontend implementation phases.
- Confirms initial platform assumptions: Docker-first local development, PostgreSQL metadata store, object storage for datasets and artifacts, and MLflow for tracking.
