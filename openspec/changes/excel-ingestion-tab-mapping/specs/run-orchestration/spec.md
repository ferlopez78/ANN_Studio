## ADDED Requirements

### Requirement: Run Launch Requires Valid Excel Ingestion Snapshot
The system SHALL require a validated ingestion snapshot when launching runs backed by Excel tabular inputs.

#### Scenario: Block launch without ingestion snapshot
- **WHEN** a user attempts to launch a run from Excel data without a finalized ingestion snapshot
- **THEN** the system blocks launch and returns precondition diagnostics

#### Scenario: Launch with valid ingestion snapshot
- **WHEN** a user launches a run with a valid ingestion snapshot reference
- **THEN** the system creates the run and binds immutable ingestion metadata to run configuration

### Requirement: Immutable Reproducibility Binding for Excel Inputs
The system SHALL persist immutable references to sheet mapping and label selection in run metadata.

#### Scenario: Reconstruct run ingestion inputs
- **WHEN** a user requests run reproducibility details
- **THEN** the system returns ingestion snapshot reference, selected sheet mapping, and label-column metadata used at launch