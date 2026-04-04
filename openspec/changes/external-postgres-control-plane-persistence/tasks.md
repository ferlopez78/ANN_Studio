## 1. Cross-Spec Consistency

- [ ] 1.1 Ensure all deltas include tenant_id ownership requirements.
- [ ] 1.2 Ensure all deltas include project-level ownership where applicable.
- [ ] 1.3 Ensure lineage fields are consistent across dataset/model/run/registry specs.

## 2. Project and Client Persistence

- [ ] 2.1 Finalize SQL migrations for tenants/users/clients/projects.
- [ ] 2.2 Finalize ABM API behavior including soft delete and conflict semantics.
- [ ] 2.3 Integrate frontend project/client views with backend source of truth.

## 3. Dataset Persistence

- [ ] 3.1 Add dataset and dataset_version tables with immutable version semantics.
- [ ] 3.2 Persist ingestion snapshots and schema fingerprints.
- [ ] 3.3 Bind datasets to tenant + project.

## 4. Model Design Persistence

- [ ] 4.1 Add model_definition and model_definition_version tables.
- [ ] 4.2 Persist architecture/training config snapshots immutably.
- [ ] 4.3 Enforce dataset-type/model-family compatibility checks using persisted metadata.

## 5. Run Orchestration Persistence

- [ ] 5.1 Add runs table with immutable dataset/model version bindings.
- [ ] 5.2 Add run_events and run_metric_points tables.
- [ ] 5.3 Persist run artifact metadata references.

## 6. Model Registry Persistence

- [ ] 6.1 Add registry model/version tables.
- [ ] 6.2 Enforce completed-run-only registration rule at persistence boundary.
- [ ] 6.3 Persist lineage links to run, dataset version, and model definition version.

## 7. Workspace Security and Audit

- [ ] 7.1 Add audit_events persistence.
- [ ] 7.2 Verify tenant isolation integration tests across all modules.
- [ ] 7.3 Ensure sensitive fields are redacted before persistence/logging.

## 8. Acceptance Gate

- [ ] 8.1 Create/read/update/delete workflows use PostgreSQL-backed source of truth.
- [ ] 8.2 Cross-tenant access attempts fail without data leakage.
- [ ] 8.3 End-to-end lineage query resolves dataset version + model version + run + registry model.
- [ ] 8.4 Mark ready for full AWS deployment validation.
