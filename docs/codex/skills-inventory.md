# ANN Studio Codex Skills Inventory

This repository uses a small, high-value skill set that complements AGENTS.md and existing OpenSpec skills.

## 1) software-architect
Purpose:
- Define architecture boundaries, ownership, layering, and integration contracts across ANN Studio modules.

Use when:
- A request affects multiple capabilities or risks control-plane/training-plane boundary drift.

Example invoke:
- $software-architect Design module boundaries for dataset ingestion, run launch, and metrics diagnostics.

## 2) database-designer
Purpose:
- Design metadata schemas and lineage-safe persistence contracts for PostgreSQL-first evolution.

Use when:
- New entities/fields, query paths, constraints, or migration strategy are needed.

Example invoke:
- $database-designer Propose schema and indexes for dataset versions, run snapshots, and model registry lineage.

## 3) ui-system-designer
Purpose:
- Design product-grade screens and reusable UI patterns aligned with Braize style and dashboard-first UX.

Use when:
- Building or refactoring ANN Studio workflows and feature screens.

Example invoke:
- $ui-system-designer Design the Dataset Preparation step with mapping table, preprocessing summary, and empty/loading/error states.

## 4) api-contract-designer
Purpose:
- Define API contracts that are explicit, testable, and stable across frontend and backend modules.

Use when:
- Creating endpoints, request/response schemas, error semantics, and state mappings.

Example invoke:
- $api-contract-designer Define inspect/validate/launch contracts for tabular run orchestration with deterministic validation errors.

## 5) code-review
Purpose:
- Execute high-signal code reviews for defects, regressions, architecture violations, and contract drift.

Use when:
- Reviewing non-trivial changes before merge or after a major refactor.

Example invoke:
- $code-review Review this Runs module refactor for state-machine regressions and API contract mismatches.

Support file:
- .codex/skills/code-review/checklist.md

## 6) feature-slicer
Purpose:
- Break complex requests into MVP-friendly vertical slices with clear contracts and acceptance checks.

Use when:
- A feature spans UI, service logic, API, and persistence concerns.

Example invoke:
- $feature-slicer Slice the tabular dataset preparation workflow into incremental deliverables for this sprint.

Support file:
- .codex/skills/feature-slicer/templates.md

## Why this set
- Minimal and sharp: 6 focused skills, each with distinct responsibility.
- Reliable triggering: names and descriptions map directly to common request intent.
- ANN Studio specific: each skill encodes architecture, lineage, and product constraints from AGENTS.md and OpenSpec design/tasks.
- Complements existing OpenSpec skills: these skills improve design/implementation quality around architecture, contracts, UI, and review.
