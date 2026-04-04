## ADDED Requirements

### Requirement: Dataset Ownership by Tenant and Project
The system SHALL bind each dataset identity and dataset version to both tenant and project ownership.

#### Scenario: Create dataset under project
- **WHEN** a user creates a dataset with a valid in-tenant project reference
- **THEN** the system persists dataset metadata linked to tenant_id and project_id

#### Scenario: Reject dataset with foreign-tenant project
- **WHEN** a user attempts to create a dataset with a project reference outside tenant scope
- **THEN** the system rejects the operation without exposing foreign-tenant details

### Requirement: Dataset Listing by Project Scope
The system SHALL support project-scoped dataset discovery within tenant boundaries.

#### Scenario: List datasets for project
- **WHEN** a user requests datasets filtered by project
- **THEN** the system returns only datasets linked to that in-tenant project
