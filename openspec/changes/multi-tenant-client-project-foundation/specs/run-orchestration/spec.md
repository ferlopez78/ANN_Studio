## ADDED Requirements

### Requirement: Run Ownership by Tenant and Project
The system SHALL bind every run to tenant and project context at creation time.

#### Scenario: Create run with project binding
- **WHEN** a user launches a run with valid dataset and project selection
- **THEN** the system persists run metadata including tenant_id and project_id

#### Scenario: Reject run with foreign-tenant project
- **WHEN** a user attempts to launch a run using project reference outside tenant scope
- **THEN** the system rejects the launch request without exposing foreign-tenant details

### Requirement: Project-Level Run Querying
The system SHALL provide project-scoped run listing for tenant users.

#### Scenario: List runs by project
- **WHEN** a user requests runs for an in-tenant project
- **THEN** the system returns only runs linked to that tenant and project
