## Context

ANN Studio must move from local MVP state to a deployable control-plane architecture backed by external PostgreSQL.
The immediate functional target is tenant-aware ABM for clients and projects, with project linkage to datasets and runs.

This change defines persistence and API contracts that can run in AWS (for example, RDS PostgreSQL) and support tenant isolation.

## Design Objectives

- Externalize control-plane metadata to PostgreSQL.
- Enforce tenant isolation at query and write boundaries.
- Support client and project ABM with auditable ownership.
- Define project-centric linkage for datasets and runs.
- Keep architecture modular for later extension to full dataset/runs/model persistence.

## Ownership Model

Canonical ownership hierarchy:

1. Tenant
- Top-level isolation boundary.

2. User
- Belongs to exactly one tenant in MVP.
- Executes operations in tenant context.

3. Client
- Belongs to one tenant.
- Represents end-customer account inside tenant workspace.

4. Project
- Belongs to one tenant and one client.
- Parent scope for datasets and runs.

5. Dataset / Run (next slices)
- Belong to one tenant and one project.

## PostgreSQL Data Contract (Initial Slice)

Required tables for this slice:

1. tenants
- id (uuid, pk)
- code (text, unique)
- name (text)
- created_at_utc (timestamptz)
- updated_at_utc (timestamptz)

2. users
- id (uuid, pk)
- tenant_id (uuid, fk -> tenants.id)
- email (text)
- display_name (text)
- role (text)
- is_active (boolean)
- created_at_utc (timestamptz)
- updated_at_utc (timestamptz)
- unique(tenant_id, email)

3. clients
- id (uuid, pk)
- tenant_id (uuid, fk -> tenants.id)
- code (text)
- name (text)
- status (text) -- active, inactive
- notes (text, nullable)
- created_by_user_id (uuid, fk -> users.id)
- created_at_utc (timestamptz)
- updated_at_utc (timestamptz)
- archived_at_utc (timestamptz, nullable)
- unique(tenant_id, code)

4. projects
- id (uuid, pk)
- tenant_id (uuid, fk -> tenants.id)
- client_id (uuid, fk -> clients.id)
- code (text)
- name (text)
- status (text) -- draft, active, paused, archived
- network_type (text)
- description (text, nullable)
- created_by_user_id (uuid, fk -> users.id)
- created_at_utc (timestamptz)
- updated_at_utc (timestamptz)
- archived_at_utc (timestamptz, nullable)
- unique(tenant_id, code)

## Project Linkage Contracts (Forward Compatibility)

Future tables (out of implementation scope for this slice) MUST include:

- datasets.tenant_id + datasets.project_id
- runs.tenant_id + runs.project_id

Lineage constraint:
- runs.project_id MUST reference the same tenant as run.tenant_id.
- datasets.project_id MUST reference the same tenant as dataset.tenant_id.

## API Contract (Initial Slice)

All endpoints are tenant-aware and require authenticated user context.
Tenant resolution source in MVP: auth claim tenant_id.

1. Create client
- POST /api/clients
- request:
  - code
  - name
  - status
  - notes
- response:
  - client id + persisted metadata

2. List clients
- GET /api/clients
- optional filters:
  - status
  - q (code/name)

3. Update client
- PATCH /api/clients/{clientId}

4. Archive client
- DELETE /api/clients/{clientId}
- behavior: soft delete (archived_at_utc set)

5. Create project
- POST /api/projects
- request:
  - clientId
  - code
  - name
  - status
  - networkType
  - description
- response:
  - project id + persisted metadata

6. List projects
- GET /api/projects
- optional filters:
  - clientId
  - status
  - q (code/name)

7. Update project
- PATCH /api/projects/{projectId}

8. Archive project
- DELETE /api/projects/{projectId}
- behavior: soft delete (archived_at_utc set)

## Validation Rules

Client rules:
- code required, uppercase normalized, tenant-unique.
- name required, max length policy defined by API validation.

Project rules:
- clientId must exist in same tenant.
- code required, uppercase normalized, tenant-unique.
- networkType must be supported enum.
- status transitions must follow allowed path (draft -> active -> paused -> archived).

Tenant isolation rules:
- Every query MUST include tenant_id filter from auth context.
- Cross-tenant clientId/projectId access MUST return not found (do not leak existence).

## Security and Multi-Tenancy

- API MUST not accept tenant_id from client payload.
- tenant_id MUST be resolved from authenticated identity.
- Audit events MUST include tenant_id, user_id, action, entity_type, entity_id, timestamp, outcome.

## AWS Deployment Direction

- External DB target: PostgreSQL-compatible managed service (for example AWS RDS PostgreSQL).
- Application configuration via environment variables:
  - DATABASE_URL
  - DB_POOL_MIN
  - DB_POOL_MAX
  - DB_SSL_MODE
- Migrations executed by backend deployment pipeline.

## Architecture Placement

Backend modules:
- project_management/application:
  - create_client
  - update_client
  - create_project
  - update_project
- project_management/domain:
  - client/project entities and invariants
- project_management/infrastructure:
  - postgres repositories
  - SQL migrations

Frontend modules:
- projects/services:
  - API client for /api/clients and /api/projects
- projects/ui:
  - forms and lists backed by API

## Open Decisions

- Final enum set for project status transitions.
- Whether client archive is allowed when active projects exist.
- Whether initial tenant/user seeding is manual migration or bootstrap endpoint.
