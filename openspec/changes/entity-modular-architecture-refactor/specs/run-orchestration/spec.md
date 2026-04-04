## ADDED Requirements

### Requirement: Backend-Driven Run Progression
The system SHALL not generate synthetic run telemetry in frontend timers for backend-orchestrated runs.

#### Scenario: Frontend run state updates
- **WHEN** run data changes in UI
- **THEN** the changes come from backend synchronization paths
- **AND** the frontend does not mutate epoch telemetry through periodic simulation intervals
