## ADDED Requirements

### Requirement: Client and Project Control-Plane Persistence
The system SHALL persist clients and projects in external PostgreSQL as tenant-scoped entities.

#### Scenario: Create client and project in tenant
- **WHEN** an authenticated tenant user creates a client and then creates a project linked to that client
- **THEN** the system persists both entities in PostgreSQL with the same tenant_id and linked client_id

#### Scenario: Archive client with active project blocked
- **WHEN** a user attempts to archive a client that still has active projects
- **THEN** the system rejects the operation with conflict diagnostics
