## ADDED Requirements

### Requirement: Tenant Isolation in Persistence Layer
The system SHALL enforce tenant isolation in repository queries and mutations across all persisted control-plane entities.

#### Scenario: Cross-tenant access rejected for persisted entity
- **WHEN** a user requests client/project/dataset/model/run/registry record outside tenant scope
- **THEN** the system rejects the request without existence leakage

### Requirement: Audit Event Persistence
The system SHALL persist audit events for privileged operations in PostgreSQL.

#### Scenario: Persist audit for run launch
- **WHEN** a user launches a run
- **THEN** the system stores an audit_event with tenant_id, user_id, action, resource type, resource id, timestamp, and outcome
