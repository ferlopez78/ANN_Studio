## ADDED Requirements

### Requirement: Multi-Modal Dataset Support
The system SHALL support registration and management of tabular datasets and computer vision datasets as first-class dataset types.

#### Scenario: Register tabular dataset
- **WHEN** a user submits a valid tabular dataset registration request
- **THEN** the system creates a dataset record with dataset type set to tabular

#### Scenario: Register computer vision dataset
- **WHEN** a user submits a valid computer vision dataset registration request
- **THEN** the system creates a dataset record with dataset type set to computer vision

### Requirement: Dataset Metadata Management
The system SHALL persist dataset metadata including owner, schema summary, source reference, and descriptive tags.

#### Scenario: Retrieve dataset metadata
- **WHEN** a user requests dataset details
- **THEN** the system returns persisted metadata for the requested dataset version

### Requirement: Dataset Versioning and Immutability
The system SHALL create immutable dataset versions and SHALL preserve historical versions for reproducibility and lineage.

#### Scenario: Create new dataset version
- **WHEN** a user publishes an updated dataset payload
- **THEN** the system creates a new immutable dataset version linked to the dataset identity

#### Scenario: Attempt mutation of historical version
- **WHEN** a user attempts to modify an existing dataset version
- **THEN** the system rejects the mutation and instructs creation of a new version

### Requirement: Configurable Split Management
The system SHALL support configurable train-validation-test split definitions for each dataset version.

#### Scenario: Valid split configuration accepted
- **WHEN** a user saves split percentages that satisfy validation rules
- **THEN** the system stores the split configuration for the dataset version

#### Scenario: Invalid split configuration rejected
- **WHEN** a user submits split percentages that violate validation rules
- **THEN** the system rejects the configuration with validation diagnostics

### Requirement: Run-Specific Dataset Version Selection
The system SHALL bind each training run to a specific dataset version and split configuration.

#### Scenario: Run created with dataset version binding
- **WHEN** a user creates a training run with valid dataset selection inputs
- **THEN** the system records dataset version and split references as immutable run metadata
