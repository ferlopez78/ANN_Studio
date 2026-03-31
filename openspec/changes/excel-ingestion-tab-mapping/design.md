## Context

ANN Studio needs to transition from visual run simulation to real training inputs.
The first required step is deterministic tabular Excel ingestion metadata capture.

This design introduces an ingestion contract where Excel workbook structure is discovered, mapped, validated, and stored before run launch.

## Design Objectives

- Guarantee deterministic extraction of Train/Val/Test frames from Excel files.
- Require explicit target-label choice from detected columns.
- Provide actionable validation diagnostics before launch.
- Persist immutable ingestion metadata for reproducibility.

## Data Flow

1. User picks Excel file in Runs (or Dataset registration flow).
2. Backend receives file handle/upload reference and inspects workbook.
3. Backend returns worksheet list and per-sheet column metadata.
4. User maps worksheets to split roles: Train, Val, Test.
5. User selects label column (target) from Train sheet columns.
6. Backend validates mapping + label compatibility and stores ingestion metadata snapshot.
7. Run launch request references this immutable ingestion snapshot.

## API Contract (MVP)

### Inspect workbook

- Endpoint: `POST /api/datasets/excel/inspect`
- Input:
  - dataset identity/version reference or transient upload token
  - excel file reference
- Output:
  - workbook name
  - worksheet list
  - per-sheet summary:
    - row count
    - column names
    - inferred types
    - null ratio sample
    - duplicate column diagnostics

### Validate mapping

- Endpoint: `POST /api/datasets/excel/validate-mapping`
- Input:
  - excel inspection reference
  - sheet mapping:
    - trainSheet
    - valSheet
    - testSheet
  - labelColumn
- Output:
  - `valid: boolean`
  - diagnostics array (error/warn/info)
  - normalized schema fingerprint

### Persist ingestion snapshot

- Endpoint: `POST /api/datasets/excel/finalize-ingestion`
- Input:
  - mapping + label + schema fingerprint
  - dataset identity/version
- Output:
  - ingestionSnapshotId (immutable)
  - persisted metadata references

## Validation Rules

- Train sheet is required.
- Val/Test requiredness is policy-driven (MVP decision pending).
- Label column must exist in Train sheet.
- Label column must not be fully null.
- Duplicate sheet-role assignment is invalid.
- Duplicate column names in selected sheets are invalid.
- Schema mismatch between Train and Val/Test columns raises diagnostic (error or warning based on policy).

## Metadata Persistence

Persist under dataset-version metadata:

- excelFileReference
- workbookName
- selectedSheetMapping
- labelColumn
- selectedFeatureColumns (optional inferred default: all non-label columns)
- schemaFingerprint
- inspectionTimestamp

Persist in run metadata:

- dataset identity/version
- ingestionSnapshotId
- labelColumn
- sheet mapping reference

## Backend Architecture Placement

- Dataset-management infrastructure:
  - Excel inspector adapter
  - schema profiler
- Dataset-management application:
  - inspect workbook use case
  - validate mapping use case
  - finalize ingestion use case
- Run-orchestration application:
  - launch precondition check for `ingestionSnapshotId`

## Operational Constraints

- Support Windows local development path handling.
- Enforce file size guardrails for sync inspection.
- Do not log raw row values; log only schema/profile aggregates.

## Open Decisions

- Policy for optional Test split in MVP.
- Allowed inferred-type coercions (numeric/string/date/boolean).
- Async inspection threshold for large workbooks.