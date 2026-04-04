## Why

ANN Studio currently mixes domain state, UI orchestration, and training simulation logic in oversized frontend and backend modules.
This increases change risk, slows feature delivery, and creates hidden coupling between model-design, run-orchestration, and project-management flows.

The product now needs a domain-modular architecture where each entity (client, project, dataset, run, model) is implemented as focused components and services with explicit contracts.

## Goals

- Refactor frontend into entity-aligned modules with smaller components and stores.
- Remove synthetic run progression from frontend and consume backend-driven run state.
- Keep backend training capabilities available while introducing incremental refactor seams for worker-based execution.
- Preserve current MVP behavior while reducing file size and responsibility concentration.

## Scope

### In scope
- Frontend modularization for model design UI (utility extraction, component decomposition).
- Frontend run store behavior update to stop synthetic timer-based epoch progression.
- New architecture standards for entity-scoped modules in frontend and backend.
- Incremental migration plan for run telemetry transport (SSE/WebSocket with polling fallback).

### Out of scope
- Full replacement of current training engine with PyTorch in this same change.
- Immediate introduction of a distributed queue stack in local development.
- Complete rewrite of all legacy modules in a single release.

## Impact

- Lower cognitive load and safer edits in model design and run workflows.
- Reduced unnecessary rerenders from global synthetic run timers.
- Clear path to production-grade backend-driven telemetry and async execution.

## Open decisions

- First transport to implement for live telemetry in MVP hardening: SSE first or WebSocket first.
- Async orchestration baseline for local mode: background thread worker vs queue-backed worker.
- Cutover sequence for replacing remaining monolithic store areas with entity stores.
