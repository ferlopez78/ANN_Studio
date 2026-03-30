## 1. Foundation and Environment Baseline

- [ ] 1.1 Define control-plane and training-plane service boundaries in architecture records
- [ ] 1.2 Define Docker Compose topology for local development (control plane, PostgreSQL, object storage, MLflow, worker)
- [ ] 1.3 Define environment variable contract for service connectivity and security-sensitive values
- [ ] 1.4 Define metadata schema migration plan for PostgreSQL baseline entities
- [ ] 1.5 Define object storage bucket and path conventions for datasets, checkpoints, and model artifacts
- [ ] 1.6 Define structured event and audit log schema shared across modules

## 2. Workspace Security Capability

- [ ] 2.1 Specify authentication baseline and session/token handling policy for MVP
- [ ] 2.2 Specify authorization matrix for dataset, run, and model registry operations
- [ ] 2.3 Specify secret handling policy (at-rest, in-transit, and runtime redaction)
- [ ] 2.4 Specify audit events for privileged actions and security-relevant failures
- [ ] 2.5 Define acceptance criteria for unauthorized access rejection paths

## 3. Dataset Management Capability

- [ ] 3.1 Define tabular dataset metadata schema and validation rules
- [ ] 3.2 Define CV dataset metadata schema and validation rules
- [ ] 3.3 Define dataset versioning lifecycle and immutability rules
- [ ] 3.4 Define train-validation-test split configuration model and validation constraints
- [ ] 3.5 Define run-time dataset version selection contract and compatibility checks
- [ ] 3.6 Define acceptance scenarios for dataset ingestion failures and version retrieval

## 4. Model Design Capability

- [ ] 4.1 Define tabular ANN binary classification model template contract
- [ ] 4.2 Define tabular ANN multiclass classification model template contract
- [ ] 4.3 Define in-house one-stage detector contract and non-AGPL dependency policy checks
- [ ] 4.4 Define shared training configuration schema (layers, activations, dropout, batch norm, optimizer, learning rate, scheduler, regularization, early stopping, batch size, epochs, seed, loss, metrics)
- [ ] 4.5 Define model-family-to-dataset-type compatibility rules
- [ ] 4.6 Define validation error contract for invalid model design payloads

## 5. Run Orchestration Capability

- [ ] 5.1 Define run creation contract with immutable run IDs and config snapshots
- [ ] 5.2 Define run lifecycle state machine and transition invariants
- [ ] 5.3 Define control-plane to training-plane launch contract and handoff payload
- [ ] 5.4 Define checkpoint persistence policy and storage naming conventions
- [ ] 5.5 Define reproducibility metadata contract linking run to dataset version and model config
- [ ] 5.6 Define run comparison query contract for side-by-side analysis

## 6. Metrics and Diagnostics Capability

- [ ] 6.1 Define real-time metric ingestion contract for train and validation curves
- [ ] 6.2 Define classification metric set for tabular model families
- [ ] 6.3 Define detection metric set for CV model family
- [ ] 6.4 Define heuristics and thresholds for likely underfitting diagnostics
- [ ] 6.5 Define heuristics and thresholds for likely overfitting diagnostics
- [ ] 6.6 Define user-facing diagnostic payload format with evidence references

## 7. Model Registry Capability

- [ ] 7.1 Define model registration contract restricted to completed runs
- [ ] 7.2 Define model version metadata schema and validation
- [ ] 7.3 Define lineage links from model version to dataset version, training config, and run
- [ ] 7.4 Define registry query and filtering contract for model discovery
- [ ] 7.5 Define constraints for updating metadata without mutating immutable lineage fields

## 8. Cross-Cutting Verification and Readiness

- [ ] 8.1 Map every OpenSpec requirement scenario to a verification strategy (automated or manual)
- [ ] 8.2 Define end-to-end reproducibility acceptance criteria across dataset, run, and registry flows
- [ ] 8.3 Define failure-mode validation matrix for storage, tracking, and orchestration dependencies
- [ ] 8.4 Define non-functional validation plan for observability, reliability, and security baseline
- [ ] 8.5 Review all OpenSpec artifacts for consistency with architecture constraints and MVP scope
