## ADDED Requirements

### Requirement: Registry Persistence in PostgreSQL
The system SHALL persist model registry entities and versions in PostgreSQL.

#### Scenario: Register model from completed run
- **WHEN** a user registers a model from completed run artifact
- **THEN** the system stores registry_model_version linked to source_run_id and lineage references

### Requirement: Registry Query from Durable Store
The system SHALL provide registry listing and filtering from PostgreSQL-backed records.

#### Scenario: Filter registry by family and status provenance
- **WHEN** a user applies registry filters
- **THEN** the system returns matching versions from persisted registry tables
