## ADDED Requirements

### Requirement: Model Registration from Completed Runs
The system SHALL register models only from runs in completed status and SHALL reject registration attempts from non-completed runs.

#### Scenario: Register model from completed run
- **WHEN** a user registers a model artifact produced by a completed run
- **THEN** the system creates a model registry entry with version and source run reference

#### Scenario: Reject registration from failed run
- **WHEN** a user attempts to register a model artifact from a failed or running run
- **THEN** the system rejects registration with a status constraint error

### Requirement: Model Metadata Management
The system SHALL persist model metadata including model family, version identifier, artifact reference, and governance tags.

#### Scenario: Retrieve model metadata
- **WHEN** a user requests details for a registered model version
- **THEN** the system returns model metadata and associated lineage references

### Requirement: Lineage Tracking
The system SHALL maintain lineage links from each registered model version to dataset version, training configuration, and source run.

#### Scenario: Traverse lineage for registered model
- **WHEN** a user requests lineage for a model version
- **THEN** the system returns linked dataset version, configuration snapshot, and source run identifiers

### Requirement: Registry Discovery and Filtering
The system SHALL provide model discovery queries with filtering by model family, version, run status provenance, and key performance indicators.

#### Scenario: Filter registry by model family
- **WHEN** a user queries the registry using model family filters
- **THEN** the system returns only matching model versions with summary metadata
