## ADDED Requirements

### Requirement: Excel Workbook Inspection for Tabular Ingestion
The system SHALL inspect uploaded Excel files and return workbook structure metadata before run launch.

#### Scenario: List workbook worksheets
- **WHEN** a user uploads or references a valid Excel file (`.xlsx` or `.xls`)
- **THEN** the system returns the list of worksheet names and workbook metadata

#### Scenario: Return per-sheet column profiling
- **WHEN** workbook inspection succeeds
- **THEN** the system returns per-sheet column names and inferred profile metadata needed for mapping decisions

### Requirement: Worksheet Mapping to Train/Val/Test Roles
The system SHALL allow mapping Excel worksheets to training split roles.

#### Scenario: Accept valid sheet-role mapping
- **WHEN** a user assigns worksheets to Train, Val, and Test according to policy
- **THEN** the system stores a validated sheet-role mapping for ingestion finalization

#### Scenario: Reject duplicate role assignment
- **WHEN** the same worksheet is assigned to conflicting split roles where policy forbids it
- **THEN** the system rejects the mapping with diagnostics identifying the conflict

### Requirement: Label Column Selection
The system SHALL require explicit label-column selection from detected worksheet columns.

#### Scenario: Accept label column from Train sheet
- **WHEN** a user selects an existing, valid label column in the Train sheet
- **THEN** the system accepts the selection and includes it in ingestion snapshot metadata

#### Scenario: Reject invalid label column
- **WHEN** the selected label column is missing, duplicated, or invalid by policy
- **THEN** the system returns validation diagnostics and blocks ingestion finalization

### Requirement: Immutable Excel Ingestion Snapshot
The system SHALL persist an immutable ingestion snapshot linked to dataset version metadata.

#### Scenario: Finalize ingestion snapshot
- **WHEN** sheet mapping and label selection pass validation
- **THEN** the system creates an immutable ingestion snapshot with schema fingerprint and mapping metadata

#### Scenario: Prevent mutation of finalized snapshot
- **WHEN** a user attempts to modify an existing ingestion snapshot
- **THEN** the system rejects mutation and requires creating a new dataset version/snapshot