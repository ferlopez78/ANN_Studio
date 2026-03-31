## ADDED Requirements

### Requirement: DataSets Filesystem Repository Contract
The system SHALL provide a backend filesystem repository named DataSets for dataset payload storage.

#### Scenario: Create canonical dataset version layout
- **WHEN** a new immutable dataset version is published
- **THEN** the system creates directories at DataSets/<dataset_identity>/<dataset_version>/Train, DataSets/<dataset_identity>/<dataset_version>/Val, and DataSets/<dataset_identity>/<dataset_version>/Test

#### Scenario: Reject mutation of existing dataset version layout
- **WHEN** an operation attempts to recreate or overwrite an existing dataset version directory
- **THEN** the system rejects the operation and requires publishing a new dataset version

### Requirement: Split Payload Readiness Validation
The system SHALL validate split directory existence and payload readiness before allowing training use.

#### Scenario: Reject missing split directory
- **WHEN** Train, Val, or Test directory is missing for a dataset version with required split policy
- **THEN** the system returns validation diagnostics identifying the missing split path

#### Scenario: Reject empty Train split
- **WHEN** Train directory exists but contains no valid tabular files
- **THEN** the system rejects run launch with a split readiness error

### Requirement: Tabular File Support in DataSets Repository
The system SHALL support tabular dataset payload discovery for CSV and Parquet files under split directories.

#### Scenario: Discover supported tabular files
- **WHEN** split directories contain files with .csv or .parquet extensions
- **THEN** the system includes those files in tabular loader resolution

#### Scenario: Report unsupported files for tabular loading
- **WHEN** a split directory contains files that are not supported by tabular loading rules
- **THEN** the system returns diagnostics listing unsupported file paths during validation

### Requirement: Tabular Batch Loading for Large Datasets
The system SHALL provide a backend batch iterator for tabular data so large datasets can be consumed with bounded memory.

#### Scenario: Stream deterministic batches without shuffle
- **WHEN** training requests batches with shuffle disabled
- **THEN** the loader yields rows in deterministic file-and-row order

#### Scenario: Stream shuffled batches with fixed seed
- **WHEN** training requests batches with shuffle enabled and a seed value
- **THEN** the loader yields batches in deterministic seeded shuffle order for reproducibility

#### Scenario: Prevent full-file in-memory loading behavior
- **WHEN** loading tabular split data for training
- **THEN** the loader reads records in chunks according to batch_size rather than loading the full split into memory

### Requirement: Run Binding to DataSets Repository References
The system SHALL bind runs to immutable dataset repository references for reproducibility.

#### Scenario: Persist immutable DataSets references in run metadata
- **WHEN** a run is created using a dataset version
- **THEN** the system persists dataset_identity, dataset_version, repository_name=DataSets, resolved repository base path snapshot, and split policy reference in immutable run metadata

#### Scenario: Reconstruct dataset input location from run metadata
- **WHEN** a user requests reproducibility reconstruction for a historical run
- **THEN** the system resolves the same DataSets dataset version split paths from immutable run metadata and reports readiness state