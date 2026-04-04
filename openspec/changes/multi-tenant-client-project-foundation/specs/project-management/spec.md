## ADDED Requirements

### Requirement: Client ABM in Tenant Workspace
The system SHALL provide tenant-scoped ABM operations for clients.

#### Scenario: Create client in tenant
- **WHEN** an authenticated user submits valid client data
- **THEN** the system creates a client record owned by the user tenant

#### Scenario: List only tenant clients
- **WHEN** an authenticated user requests client listing
- **THEN** the system returns only client records owned by the same tenant

#### Scenario: Update tenant client
- **WHEN** an authenticated user updates a client owned by the same tenant
- **THEN** the system persists the update and records audit metadata

#### Scenario: Archive tenant client
- **WHEN** an authenticated user archives a client owned by the same tenant
- **THEN** the system marks the client archived and excludes it from default active listings

### Requirement: Project ABM Linked to Client
The system SHALL provide tenant-scoped ABM operations for projects linked to a client.

#### Scenario: Create project with client binding
- **WHEN** an authenticated user submits valid project data including client reference
- **THEN** the system creates a project linked to the specified in-tenant client

#### Scenario: Reject project with foreign-tenant client
- **WHEN** an authenticated user submits a project request with a client ID outside tenant scope
- **THEN** the system rejects the request without exposing foreign-tenant record details

#### Scenario: Update project metadata
- **WHEN** an authenticated user updates a project owned by the same tenant
- **THEN** the system persists validated project changes and updates audit metadata

#### Scenario: Archive project
- **WHEN** an authenticated user archives a project owned by the same tenant
- **THEN** the system marks the project archived and excludes it from default active listings

### Requirement: Project Validation and Uniqueness
The system SHALL enforce project and client validation rules per tenant.

#### Scenario: Reject duplicate client code in tenant
- **WHEN** a user creates or updates a client with a code already used in the same tenant
- **THEN** the system rejects the operation with validation diagnostics

#### Scenario: Reject duplicate project code in tenant
- **WHEN** a user creates or updates a project with a code already used in the same tenant
- **THEN** the system rejects the operation with validation diagnostics

#### Scenario: Reject unsupported project network type
- **WHEN** a user submits a project with unsupported network type
- **THEN** the system rejects the operation with validation diagnostics
