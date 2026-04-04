## ADDED Requirements

### Requirement: Tenant-Isolated Access for Control Plane Entities
The system SHALL enforce strict tenant isolation for clients, projects, datasets, runs, and models.

#### Scenario: Tenant-scoped list query
- **WHEN** an authenticated user lists clients or projects
- **THEN** the system returns only records owned by the user's tenant

#### Scenario: Cross-tenant read prevented
- **WHEN** an authenticated user requests a resource owned by a different tenant
- **THEN** the system rejects access without exposing record existence details

#### Scenario: Cross-tenant write prevented
- **WHEN** an authenticated user attempts to update or archive a resource owned by a different tenant
- **THEN** the system rejects the operation and records an authorization failure audit event

### Requirement: Trusted Tenant Context Resolution
The system SHALL derive tenant context from authenticated identity claims instead of request payload fields.

#### Scenario: Payload tenant override ignored
- **WHEN** a request payload includes tenant_id or equivalent tenant selector
- **THEN** the system ignores payload tenant fields and resolves tenant from authenticated identity

### Requirement: Multi-Tenant Audit Trail
The system SHALL emit audit events for client and project ABM operations with tenant and actor context.

#### Scenario: Client/project mutation audited
- **WHEN** client or project create/update/archive operation is executed
- **THEN** the system writes audit records including tenant_id, user_id, action, resource type, resource id, timestamp, and outcome
