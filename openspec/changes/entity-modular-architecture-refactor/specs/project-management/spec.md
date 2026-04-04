## ADDED Requirements

### Requirement: Entity-Aligned Frontend State Boundaries
The system SHALL evolve frontend state management toward entity-aligned stores for clients, projects, datasets, runs, and model-design.

#### Scenario: Incremental store decomposition
- **WHEN** new refactor slices are implemented
- **THEN** state responsibilities are moved from global hooks into entity-scoped modules
- **AND** cross-entity updates are done through explicit service calls or selectors
