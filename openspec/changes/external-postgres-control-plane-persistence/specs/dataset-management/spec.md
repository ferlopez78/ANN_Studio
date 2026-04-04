## ADDED Requirements

### Requirement: Dataset and Dataset-Version PostgreSQL Persistence
The system SHALL persist dataset identities and immutable dataset versions in external PostgreSQL.

#### Scenario: Create dataset version
- **WHEN** a user publishes dataset updates
- **THEN** the system creates a new immutable dataset_version record linked to tenant_id and project_id

### Requirement: Ingestion Snapshot Persistence
The system SHALL persist dataset ingestion mapping snapshots as immutable references.

#### Scenario: Persist excel ingestion snapshot
- **WHEN** a user finalizes excel train/val/test mapping and label selection
- **THEN** the system stores immutable ingestion snapshot metadata linked to dataset_version_id
