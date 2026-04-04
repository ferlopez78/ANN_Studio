## Context

ANN Studio needs a maintainable architecture aligned to product entities.
Current pain points include oversized UI modules and synthetic run simulation in frontend state management.
This design defines the target modular shape and the first implementation slice.

## Design Objectives

- Enforce entity-first module boundaries.
- Keep business logic in utilities/services and keep UI components focused on rendering and interaction.
- Move run lifecycle authority to backend state.
- Enable phased migration without feature freeze.

## Target Frontend Structure

Entity modules:
- clients
- projects
- datasets
- runs
- model-design

Each entity module SHOULD include:
- services (API calls and DTO mapping)
- state (store slice / selectors)
- ui (container + presentational components)
- lib (pure utilities)

Cross-cutting concerns:
- app shell, navigation, and shared UI primitives stay in shared modules.

## Target Backend Structure

Domain-oriented modules by entity:
- application (use cases)
- domain (entities, invariants)
- infrastructure (repositories, persistence, transport adapters)

Run orchestration evolution path:
1. API accepts run launch and persists run intent.
2. Execution happens out of request path (worker mode).
3. Metrics/events persisted and streamed to frontend.

## Run Telemetry Contract

- Frontend MUST treat backend as the source of truth for run status and epoch metrics.
- Synthetic epoch generation in frontend store is not allowed for backend runs.
- Telemetry transport MAY use SSE or WebSocket; polling remains fallback.

## First Implementation Slice (This change)

1. Model Design UI decomposition
- extract architecture preview into focused component
- extract wizard tabs into focused component
- extract form parsing/building logic into utility module

2. Run store behavior hardening
- remove global timer that mutates run telemetry with synthetic values
- keep explicit backend synchronization as the progression mechanism

## Non-functional Requirements

- No behavior regression for create/edit/delete model design flows.
- No entity state updates should depend on background synthetic intervals.
- New modules must remain typed and avoid hidden implicit casts.

## Rollout Strategy

- ship decomposition with no API contract break
- validate build + existing entity workflows
- continue in next slices with store splitting by entity and backend telemetry transport
