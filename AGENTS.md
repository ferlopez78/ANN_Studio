# AGENTS.md

## Project
ANN Studio

## Mission
Build a web-based platform to design, configure, train, monitor, compare, and manage neural-network-based models.

The product must support:
- tabular ANN models for binary classification
- tabular ANN models for multiclass classification
- a custom in-house one-stage object detector for computer vision
- dataset management, run orchestration, live metrics, diagnostics, and model registry

## Current Phase
We are in the specification and architecture phase.

At this stage:
- prioritize OpenSpec artifacts over source code
- clarify requirements, boundaries, and architecture first
- do not scaffold or generate large amounts of application code unless explicitly requested
- do not invent implementation details that have not been agreed in specs

## Mandatory Workflow
Use OpenSpec as the default workflow for non-trivial changes.

Preferred flow:
1. create or update an OpenSpec change
2. complete proposal.md
3. complete design.md
4. complete tasks.md
5. add or update delta specs
6. only then move to implementation when explicitly requested

If a request implies significant product or architecture changes and there is no active OpenSpec change, propose creating one first.

## Product Scope Guardrails
ANN Studio is a product platform, not a notebook playground.

Always preserve these product boundaries:
- clear separation between control plane and training plane
- modular architecture by domain
- reproducibility of runs
- dataset versioning and lineage
- model lineage to dataset version, config, and run
- real-time or near-real-time training metrics visibility
- explicit diagnostics for likely underfitting and overfitting

## Technical Direction
Target architecture:
- web-based product
- backend-first orchestration for training workflows
- PostgreSQL for product metadata
- object storage for datasets, artifacts, checkpoints, and exported models
- MLflow for experiment tracking
- Docker-first local development
- intended to run first on developer machines

Preferred implementation language for ML and backend logic:
- Python

Expected major areas:
- workspace-security
- dataset-management
- model-design
- run-orchestration
- metrics-diagnostics
- model-registry

## Model Constraints
For computer vision:
- prefer an in-house detector implementation
- do not rely on AGPL implementation code
- importing common dataset formats is allowed
- architecture should be modular: backbone, neck, head, losses, post-processing

For tabular models:
- support configurable hidden layers, activations, dropout, normalization, optimizer, scheduler, seed, early stopping, and metrics

## Source Code Rules
Unless explicitly asked to implement code:
- do not create frontend scaffolding
- do not create backend scaffolding
- do not create Docker Compose files
- do not create database schemas
- do not create training scripts

When code is requested later:
- keep code modular and production-oriented
- avoid monolithic files
- prefer explicit types and clear contracts
- separate domain logic from infrastructure
- avoid hardcoded paths, secrets, and environment-specific assumptions

## Spec Writing Rules
When editing OpenSpec artifacts:
- write in English
- be concrete and implementation-oriented
- avoid vague statements
- define scope and out-of-scope clearly
- include non-functional requirements when relevant
- write tasks as actionable checklist items
- preserve consistency across proposal, design, tasks, and specs

## Communication Style
When responding:
- be concise, structured, and practical
- explain tradeoffs clearly
- surface assumptions explicitly
- do not pretend uncertainty is certainty
- if something is not yet decided, mark it as an open decision

## Repository Conventions
Treat the repository root as the project root.

Important directories:
- `openspec/` for specs and changes
- application folders will be created later, only when requested

Do not rename the project or repository without explicit instruction.

## Definition of Done for Spec Phase
A change is ready for implementation only when:
- proposal.md is complete
- design.md is complete
- tasks.md is complete
- required delta specs exist
- scope, constraints, and boundaries are clear
- open decisions are explicitly listed
