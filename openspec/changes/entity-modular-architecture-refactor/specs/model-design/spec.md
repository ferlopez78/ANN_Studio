## ADDED Requirements

### Requirement: Modular Model Design UI Components
The system SHALL implement model design UI using focused components and utility modules instead of a single monolithic component.

#### Scenario: Build model payload from extracted utility
- **WHEN** the user submits model design create or edit
- **THEN** the payload is built by dedicated model-design utility functions
- **AND** UI components do not contain payload parsing logic inline

#### Scenario: Render architecture preview via dedicated component
- **WHEN** the user edits ANN or CNN layer configuration
- **THEN** architecture visualization is rendered by an isolated preview component
- **AND** parent container remains focused on orchestration and actions
