## ADDED Requirements

### Requirement: Real-Time Training and Validation Curves
The system SHALL provide near-real-time visibility of training and validation metric curves for active runs.

#### Scenario: View live training curves
- **WHEN** a run is in running state and emits metrics
- **THEN** the system updates train and validation curve data for the run without waiting for run completion

### Requirement: Tabular Classification Metrics
The system SHALL provide classification metrics for tabular model runs, including at minimum accuracy and class-sensitive performance indicators.

#### Scenario: Tabular run metrics available
- **WHEN** a tabular classification run emits evaluation results
- **THEN** the system stores and exposes classification metrics for diagnostics and comparison

### Requirement: CV Detection Metrics
The system SHALL provide detection metrics for computer vision model runs, including detection quality indicators suitable for one-stage detector evaluation.

#### Scenario: Detection run metrics available
- **WHEN** a computer vision detection run emits evaluation results
- **THEN** the system stores and exposes detection metrics for diagnostics and comparison

### Requirement: Underfitting Heuristic Diagnostics
The system SHALL compute and expose heuristic signals for likely underfitting based on observed training and validation behavior.

#### Scenario: Underfitting signal raised
- **WHEN** metrics satisfy configured underfitting heuristic conditions
- **THEN** the system emits an underfitting diagnostic signal with supporting metric evidence

### Requirement: Overfitting Heuristic Diagnostics
The system SHALL compute and expose heuristic signals for likely overfitting based on divergence patterns between training and validation outcomes.

#### Scenario: Overfitting signal raised
- **WHEN** metrics satisfy configured overfitting heuristic conditions
- **THEN** the system emits an overfitting diagnostic signal with supporting metric evidence
