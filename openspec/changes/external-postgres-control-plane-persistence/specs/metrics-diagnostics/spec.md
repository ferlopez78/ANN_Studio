## ADDED Requirements

### Requirement: Persisted Metrics Query Source
The system SHALL serve diagnostics curves and metric summaries from persisted PostgreSQL metric data.

#### Scenario: Query run curves after restart
- **WHEN** a user opens diagnostics for a historical run after service restart
- **THEN** the system returns train/validation curves from persisted run_metric_points data

### Requirement: Persisted Heuristic Signals
The system SHALL persist underfitting and overfitting heuristic signal records per run.

#### Scenario: Store overfitting signal
- **WHEN** divergence heuristics cross configured threshold
- **THEN** the system persists a diagnostic signal entry linked to run_id and epoch
