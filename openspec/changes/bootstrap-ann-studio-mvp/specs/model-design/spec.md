## ADDED Requirements

### Requirement: Supported Model Families
The system SHALL support model design definitions for tabular ANN binary classification, tabular ANN multiclass classification, and an in-house one-stage object detector.

#### Scenario: Create tabular binary model definition
- **WHEN** a user selects tabular binary classification family and provides valid configuration
- **THEN** the system accepts and stores the model definition

#### Scenario: Create tabular multiclass model definition
- **WHEN** a user selects tabular multiclass classification family and provides valid configuration
- **THEN** the system accepts and stores the model definition

#### Scenario: Create in-house detector model definition
- **WHEN** a user selects one-stage detector family and provides valid configuration
- **THEN** the system accepts and stores the model definition

### Requirement: Non-AGPL Implementation Compliance
The system SHALL enforce policy checks that prevent use of AGPL implementation code dependencies in model design definitions.

#### Scenario: AGPL dependency detected
- **WHEN** a model design includes disallowed AGPL implementation dependency references
- **THEN** the system rejects the model design with a compliance policy error

### Requirement: Training Configuration Surface
The system SHALL support configuration fields for hidden layers, activation functions, dropout, batch normalization, optimizer, learning rate, scheduler, regularization, early stopping, batch size, epochs, seed, loss function, and evaluation metrics.

#### Scenario: Complete training configuration accepted
- **WHEN** a user submits all required training configuration fields with valid values
- **THEN** the system validates and stores the configuration snapshot for run usage

#### Scenario: Invalid configuration field rejected
- **WHEN** a user submits an unsupported or invalid training configuration field value
- **THEN** the system rejects the payload with field-level diagnostics

### Requirement: Dataset-Type and Model-Family Compatibility
The system SHALL validate compatibility between dataset type and selected model family before run orchestration begins.

#### Scenario: Compatible model and dataset pairing
- **WHEN** a user selects a model family compatible with the selected dataset type
- **THEN** the system allows progression to run creation

#### Scenario: Incompatible model and dataset pairing
- **WHEN** a user selects a model family incompatible with the selected dataset type
- **THEN** the system blocks run creation and reports compatibility errors
