## Why

Current ANN Studio Runs UX is telemetry-oriented and does not yet capture real tabular Excel ingestion decisions required for training execution.
For real ANN training, the platform must collect explicit dataset extraction metadata from Excel payloads:
- available worksheet list
- mapping of worksheet to Train/Val/Test split roles
- target label column selection

Without this capability, backend training jobs cannot deterministically reconstruct input tensors and label vectors from uploaded Excel files.

## Goals

- Add real Excel ingestion workflow for tabular datasets.
- List available Excel worksheets after file selection/upload.
- Let users map sheets to Train/Val/Test roles.
- Detect sheet columns and allow explicit label-column selection.
- Persist ingestion mapping as immutable dataset-version metadata for reproducible run binding.

## Scope

### In scope
- `.xlsx` and `.xls` tabular ingestion metadata extraction.
- Worksheet discovery and validation.
- Train/Val/Test worksheet mapping rules.
- Column profiling (name, inferred type, nullability, distinct-count sample).
- Explicit label column selection per training configuration.
- Backend request/response contract for ingestion metadata and validation diagnostics.

### Out of scope
- Real training execution orchestration implementation.
- Model artifact export/download implementation.
- Feature engineering UI (encoding/imputation pipelines).
- CV dataset ingestion workflows.

## Impact

- Extends dataset-management and run-orchestration contracts with ingestion metadata requirements.
- Unblocks real backend training handoff for tabular Excel data.
- Improves reproducibility by capturing extraction decisions before run launch.

## Open decisions

- Whether Test sheet is mandatory in MVP or optional by policy.
- Whether multi-label targets are in MVP scope or single-label only.
- Maximum supported worksheet row count for synchronous profiling in local mode.