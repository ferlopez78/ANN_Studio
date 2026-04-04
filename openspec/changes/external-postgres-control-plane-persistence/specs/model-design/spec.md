## ADDED Requirements

### Requirement: Model Definition Version Persistence
The system SHALL persist model definitions and immutable model definition versions in external PostgreSQL.

#### Scenario: Save model definition version
- **WHEN** a user saves a valid model architecture/training configuration
- **THEN** the system stores a new model_definition_version linked to tenant_id and project_id

### Requirement: Model Design Lineage Readiness
The system SHALL expose model definition version identifiers usable by run orchestration.

#### Scenario: Resolve model version for run launch
- **WHEN** a run launch is requested with model selection
- **THEN** the system resolves and binds immutable model_definition_version_id
