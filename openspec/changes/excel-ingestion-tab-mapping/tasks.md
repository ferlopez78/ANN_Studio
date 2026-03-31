## 1. Spec Consistency

- [ ] 1.1 Ensure proposal, design, and specs use the same naming for worksheet mapping and label-column selection.
- [ ] 1.2 Ensure reproducibility fields are aligned between dataset-management and run-orchestration.

## 2. Dataset Management Delta

- [ ] 2.1 Add requirement for Excel workbook inspection and worksheet listing.
- [ ] 2.2 Add requirement for Train/Val/Test worksheet role mapping.
- [ ] 2.3 Add requirement for column detection and label-column selection.
- [ ] 2.4 Add requirement for mapping and schema validation diagnostics.
- [ ] 2.5 Add requirement for immutable ingestion snapshot persistence.

## 3. Run Orchestration Delta

- [ ] 3.1 Add requirement for run launch precondition: valid ingestion snapshot required.
- [ ] 3.2 Add requirement for immutable run binding to ingestion snapshot metadata.

## 4. Implementation Readiness

- [ ] 4.1 Define request/response schemas for inspect, validate, and finalize endpoints.
- [ ] 4.2 Define backend error taxonomy for workbook/worksheet/schema/label validation.
- [ ] 4.3 Define UI state model for sheet mapping + label picker + diagnostics display.
- [ ] 4.4 Define integration test matrix for valid/invalid workbook scenarios.

## 5. Acceptance Gate

- [ ] 5.1 Validate end-to-end flow: inspect workbook -> map sheets -> choose label -> persist snapshot.
- [ ] 5.2 Validate run launch reads immutable ingestion snapshot references.
- [ ] 5.3 Mark ready for implementation once all above are complete.