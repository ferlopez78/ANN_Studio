## ADDED Requirements

### Requirement: Training Run Creation and Launch
The system SHALL allow users to create and launch training runs with immutable run identifiers and persisted configuration snapshots.

#### Scenario: Create and launch run
- **WHEN** a user submits valid dataset, model, and training configuration selections
- **THEN** the system creates a run record with immutable run ID and launches the run in the training plane

### Requirement: Run Lifecycle Tracking
The system SHALL track run lifecycle status transitions including queued, running, completed, failed, and canceled.

#### Scenario: Run status transitions to completed
- **WHEN** a training run finishes successfully
- **THEN** the system sets run status to completed and records completion metadata

#### Scenario: Run status transitions to failed
- **WHEN** a training run terminates due to execution error
- **THEN** the system sets run status to failed and records failure diagnostics

### Requirement: Checkpoint Persistence
The system SHALL persist run checkpoints to object storage and associate checkpoint metadata with the originating run.

#### Scenario: Checkpoint saved during run
- **WHEN** a run reaches a checkpoint-save condition
- **THEN** the system stores checkpoint artifact references linked to the run ID

### Requirement: Run Comparison
The system SHALL provide run comparison capabilities for selected runs including configuration and metric summaries.

#### Scenario: Compare two runs
- **WHEN** a user requests comparison for multiple completed runs
- **THEN** the system returns a side-by-side summary of key configuration values and performance metrics

### Requirement: Reproducibility Metadata
The system SHALL persist reproducibility metadata linking each run to dataset version, model definition, and training configuration.

#### Scenario: Reconstruct run inputs
- **WHEN** a user requests reproducibility details for a historical run
- **THEN** the system returns immutable references to dataset version, model definition, and training config snapshot
