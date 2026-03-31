## 0. Scope and Change Hygiene

- [ ] 0.1 Confirm in-scope capabilities for this change: workspace-security, dataset-management, model-design, run-orchestration, metrics-diagnostics, model-registry
- [ ] 0.2 Mark app-bootstrap, experiment-registry, inference-workspace, and training-workflows as deferred in planning artifacts
- [ ] 0.3 Ensure proposal, design, and tasks use identical MVP scope language

## 1. Architecture Baseline

- [ ] 1.1 Document control-plane and training-plane responsibilities and forbidden cross-boundary mutations
- [ ] 1.2 Define local runtime topology for control plane, worker, PostgreSQL, object storage, and MLflow
- [ ] 1.3 Define environment contract for service URLs, credentials, and security-sensitive variables
- [ ] 1.4 Define canonical identifiers and cross-system reference rules for run IDs and lineage keys
- [ ] 1.5 Define feature-first folder structure standard for frontend and backend
- [ ] 1.6 Define mandatory layering standard: presentation, application/service, domain, and infrastructure
- [ ] 1.7 Define implementation guardrails to prevent monolithic files and spaghetti coupling
- [ ] 1.8 Approve MVP v1 concrete folder blueprint for frontend and backend before writing implementation code

## 2. Workspace Security Delta Completion

- [ ] 2.1 Finalize authentication baseline requirement scenarios
- [ ] 2.2 Finalize authorization requirement scenarios for dataset registration, run launch, and model registration
- [ ] 2.3 Finalize redaction and sensitive-field handling requirement scenarios
- [ ] 2.4 Finalize audit event requirement scenarios and required audit payload fields
- [ ] 2.5 Add explicit rejection-path scenario coverage for unauthorized operations

## 3. Dataset Management Delta Completion

- [ ] 3.1 Finalize tabular dataset metadata schema requirements and validation scenarios
- [ ] 3.2 Finalize CV dataset metadata schema requirements and validation scenarios
- [ ] 3.3 Finalize immutable dataset version lifecycle requirements
- [ ] 3.4 Finalize split configuration constraints and invalid-input scenarios
- [ ] 3.5 Finalize run-time dataset version binding and compatibility scenarios

## 4. Model Design Delta Completion

- [ ] 4.1 Finalize tabular binary and tabular multiclass model definition scenarios
- [ ] 4.2 Finalize in-house one-stage detector requirements and non-AGPL policy checks
- [ ] 4.3 Finalize shared training configuration field set and field-level validation scenarios
- [ ] 4.4 Finalize model-family and dataset-type compatibility gate requirements

## 5. Run Orchestration Delta Completion

- [ ] 5.1 Finalize immutable run creation contract scenarios
- [ ] 5.2 Finalize lifecycle state transitions and terminal state constraints
- [ ] 5.3 Finalize control-plane to training-plane launch handoff contract
- [ ] 5.4 Finalize checkpoint persistence references and naming policy rules
- [ ] 5.5 Finalize run comparison contract scenarios
- [ ] 5.6 Finalize reproducibility reconstruction scenario requirements

## 6. Metrics and Diagnostics Delta Completion

- [ ] 6.1 Finalize near-real-time train and validation curve visibility requirements
- [ ] 6.2 Finalize tabular metric minimum set requirements
- [ ] 6.3 Finalize CV detection metric minimum set requirements
- [ ] 6.4 Finalize underfitting and overfitting advisory diagnostic requirements with evidence payload expectations

## 7. Model Registry Delta Completion

- [ ] 7.1 Finalize completed-run-only registration requirement scenarios
- [ ] 7.2 Finalize model version metadata requirements
- [ ] 7.3 Finalize immutable lineage link requirements
- [ ] 7.4 Finalize registry query and filtering requirement scenarios

## 8. Dashboard Contract Readiness

- [ ] 8.1 Define dashboard data contract for KPI cards, recent runs, alerts, and quick actions
- [ ] 8.2 Define freshness expectations for run status and active metric updates in dashboard views
- [ ] 8.3 Define empty, loading, and failure state expectations for dashboard data surfaces

## 9. Verification and Implementation Readiness

- [ ] 9.1 Create a requirement-to-verification matrix for all in-scope scenarios
- [ ] 9.2 Validate end-to-end reproducibility criteria from dataset version to registered model
- [ ] 9.3 Validate failure-mode coverage for storage, tracking, and orchestration dependencies
- [ ] 9.4 Validate non-functional coverage for security, observability, reliability, and local portability
- [ ] 9.5 Run final consistency review across proposal, design, tasks, and in-scope delta specs
- [ ] 9.6 Mark this change ready for implementation only after all above checks are complete
- [ ] 9.7 Perform architecture review to verify folder-by-feature organization and layer separation in delivered code
- [ ] 9.8 Verify every implemented feature module follows the agreed folder blueprint and separation rules

## 10. Incremental Frontend MVP Checkpoints

- [x] 10.1 Deliver Projects inventory list with pagination controls and row-level details access
- [x] 10.2 Deliver list-to-form navigation for create/edit project workflows and return to list behavior
- [x] 10.3 Deliver project lifecycle status selector and remove action in project inventory list
- [x] 10.4 Restrict project details visibility to modal popup interaction
- [ ] 10.5 Add project detail route and deep-linking support for direct navigation
- [x] 10.6 Require dataset-to-project association on dataset creation with N:N support
- [x] 10.7 Deliver datasets list-first flow with create/edit navigation and return-to-list behavior
- [x] 10.8 Deliver dataset row actions: reassign projects, remove dataset, and details modal popup
- [x] 10.9 Deliver project list and quick project creation entrypoint inside Datasets module
- [x] 10.10 Replace datasets-side project grid with search-based helper modal for project association
- [x] 10.11 Add helper-modal pagination and search-term highlight for project association at scale
- [x] 10.12 Deliver cohesive premium UI visual system across dashboard, datasets, projects, runs, registry, and modals
- [x] 10.13 Apply premium, consistent look-and-feel refinement to all popup screens and helper dialogs
- [x] 10.14 Standardize cross-entity association UX with reusable popup search helper and selected-item mini-grid pattern
- [x] 10.15 Deliver Model Design workflow with neural-network configuration and local .pt artifact generation/download
- [x] 10.16 Refactor model artifact creation into a feature service contract and local adapter for backend handoff readiness
- [x] 10.17 Persist datasets, runs, models, and projects in browser database (IndexedDB) with migration from legacy localStorage keys
- [x] 10.18 Deliver list-first Model Design workspace with create/edit/remove actions and model-graph preview access
- [x] 10.19 Deliver 3-step model creation flow (type+links, ANN/CNN architecture with live visualization, training setup with curated optimizer/scheduler/activation lists)
- [x] 10.20 Implement URI-based model artifact storage contract with separate artifact repository persistence and download resolution by artifact URI
- [x] 10.21 Expand step-2 architecture builder to full per-layer/per-block configurability and surface detailed layer metadata in real-time visual representation
- [x] 10.22 Deliver Run menu live training monitor with epoch-by-epoch train/val loss and precision curves, live layer activation view, learning-rate/last-precision telemetry, and confusion-matrix visualization
