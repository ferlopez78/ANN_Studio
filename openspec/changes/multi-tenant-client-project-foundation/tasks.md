## 1. Spec Consistency

- [ ] 1.1 Confirm proposal, design, and delta specs use the same ownership hierarchy: tenant -> client -> project.
- [ ] 1.2 Confirm tenant isolation rules are explicitly defined in all affected specs.
- [ ] 1.3 Confirm soft-delete policy language is consistent for clients and projects.

## 2. Project Management Delta

- [ ] 2.1 Add requirement for client ABM (create, list, update, archive).
- [ ] 2.2 Add requirement for project ABM (create, list, update, archive).
- [ ] 2.3 Add requirement for project ownership by client and tenant.
- [ ] 2.4 Add requirement for project status and network type validation.

## 3. Workspace Security Delta

- [ ] 3.1 Add requirement for tenant-scoped query and write isolation.
- [ ] 3.2 Add requirement to resolve tenant context from authenticated identity (not payload).
- [ ] 3.3 Add requirement for multi-tenant audit logging on client/project operations.

## 4. Dataset and Run Linkage Deltas

- [ ] 4.1 Add requirement that datasets are linked to tenant + project.
- [ ] 4.2 Add requirement that runs are linked to tenant + project.
- [ ] 4.3 Add requirement that run/dataset references enforce same-tenant project ownership.

## 5. Implementation Readiness (Project Slice)

- [ ] 5.1 Define SQL migration for tenants, users, clients, projects.
- [ ] 5.2 Define backend repository interfaces and PostgreSQL implementation for clients/projects.
- [ ] 5.3 Define API contract validation and error taxonomy for /api/clients and /api/projects.
- [ ] 5.4 Define frontend service integration replacing local-only project persistence.
- [ ] 5.5 Define integration test matrix for tenant isolation and ABM workflows.

## 6. Acceptance Gate

- [ ] 6.1 Verify ABM client and ABM project workflows operate against external PostgreSQL.
- [ ] 6.2 Verify cross-tenant access attempts are rejected without data leakage.
- [ ] 6.3 Verify project creation requires an in-tenant client reference.
- [ ] 6.4 Mark ready for implementation once all required tasks are complete.
