## 1. Proposal and Design Consistency

- [ ] 1.1 Confirm proposal, design, and delta spec use the same repository naming: DataSets.
- [ ] 1.2 Confirm split directory naming is consistent: Train, Val, Test.
- [ ] 1.3 Confirm tabular-first scope is explicit and CV loaders are out of scope.

## 2. Dataset Management Delta Completion

- [ ] 2.1 Add requirement for filesystem repository contract with canonical path layout.
- [ ] 2.2 Add requirement for immutable dataset-version directory behavior.
- [ ] 2.3 Add requirement for split payload readiness validation.
- [ ] 2.4 Add requirement for tabular file type support and unsupported-file diagnostics.
- [ ] 2.5 Add requirement for schema consistency validation within each split.

## 3. Batch Loading Contract Completion

- [ ] 3.1 Define backend interface for tabular batch iterator consumption.
- [ ] 3.2 Define deterministic ordering behavior when shuffle=false.
- [ ] 3.3 Define memory-bounded loading expectation for large files.
- [ ] 3.4 Define failure behavior for empty Train split and inaccessible repository root.

## 4. Reproducibility and Run Binding

- [ ] 4.1 Define run metadata fields required to resolve immutable dataset repository references.
- [ ] 4.2 Define compatibility checks between run dataset binding and repository split readiness.
- [ ] 4.3 Define reconstruction expectations for replaying training dataset inputs.

## 5. Implementation Readiness Checklist

- [ ] 5.1 Confirm backend layering placement for repository and loader classes (infrastructure) and use cases (application).
- [ ] 5.2 Confirm Windows-safe path normalization and traversal protection requirements are covered.
- [ ] 5.3 Confirm logging redaction and operational metric-only logging for loader operations.
- [ ] 5.4 Confirm unresolved decisions are listed and do not block initial tabular MVP implementation path.