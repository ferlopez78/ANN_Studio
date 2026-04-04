## ADDED Requirements

### Requirement: Run Metadata Persistence in PostgreSQL
The system SHALL persist run metadata in PostgreSQL with immutable dataset/model version bindings.

#### Scenario: Create run with immutable bindings
- **WHEN** a user launches a run
- **THEN** the system persists run record with tenant_id, project_id, dataset_version_id, and model_definition_version_id

### Requirement: Run Event and Metric Persistence
The system SHALL persist run status events and metric points in PostgreSQL.

#### Scenario: Persist run status feed
- **WHEN** backend training emits queued/running/completed/failed events
- **THEN** the system stores ordered run_events linked to run_id

#### Scenario: Persist epoch metric points
- **WHEN** backend training emits epoch metrics
- **THEN** the system stores run_metric_points for diagnostics and comparison queries
