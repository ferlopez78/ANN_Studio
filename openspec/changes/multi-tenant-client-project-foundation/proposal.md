## Why

ANN Studio currently stores business entities (projects, datasets, runs, models) in local browser state, which is not suitable for a deployable SaaS product.
The product now requires a real multi-tenant architecture where:
- multiple authenticated users can operate in the same tenant workspace
- each tenant can manage its own business clients
- projects are linked to clients
- datasets and runs are linked to projects
- data is isolated across tenants

Without a shared external database contract, AWS deployment and team collaboration are blocked.

## Goals

- Define a PostgreSQL-first external persistence contract for ANN Studio control-plane metadata.
- Introduce multi-tenant ownership model for users, clients, projects, datasets, and runs.
- Define ABM (alta, baja, modificacion) for clients and projects.
- Define linkage rules: project -> datasets and project -> runs.
- Start implementation scope with project management while preserving future extension to datasets, runs, and models.

## Scope

### In scope
- External PostgreSQL metadata persistence baseline.
- Tenant-aware identity references in all core entities.
- Client ABM requirements.
- Project ABM requirements.
- Project linkage requirements for dataset and run ownership.
- API contracts and validation rules for client/project operations.

### Out of scope
- Full implementation of dataset/runs/model registry persistence in this first slice.
- Billing, subscription, and commercial tenant lifecycle.
- SSO/OIDC provider-specific implementation details.
- Data migration from local browser storage.

## Impact

- Establishes deployable data architecture for AWS-hosted environments.
- Defines canonical ownership boundaries required for secure multi-tenancy.
- Unblocks backend-first implementation of project management and later runs/datasets persistence.

## Open decisions

- Soft delete vs hard delete policy for clients and projects.
- Whether project name uniqueness is tenant-wide or client-scoped.
- Initial role model for project write permissions (tenant-admin only vs editor role).
