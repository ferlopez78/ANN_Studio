## Context

This change specifies the backend dataset payload repository contract for local MVP execution.
It introduces a filesystem-first repository named DataSets and a tabular batch loading design aligned with ANN Studio control-plane/training-plane boundaries.

## Design Objectives

- Keep dataset payload storage deterministic and inspectable on local developer machines.
- Enforce immutable dataset version paths once published.
- Support large tabular data ingestion through bounded-memory batch reads.
- Keep loader interfaces backend-first and decoupled from training model internals.

## Repository Contract

### Repository name and root

- Logical repository name: DataSets.
- Local root path: configurable via environment variable DATASETS_FS_ROOT.
- If DATASETS_FS_ROOT is not provided, default to ./DataSets relative to backend runtime working directory.

### Canonical path layout

For each immutable dataset version, payloads SHALL be written under:

DataSets/<dataset_identity>/<dataset_version>/

Required split directories under each dataset version:

- Train/
- Val/
- Test/

Resulting canonical structure:

DataSets/<dataset_identity>/<dataset_version>/Train/
DataSets/<dataset_identity>/<dataset_version>/Val/
DataSets/<dataset_identity>/<dataset_version>/Test/

### File type support for tabular MVP

- Supported extensions for this change: .csv and .parquet.
- Multiple files per split are allowed.
- Non-tabular files are allowed to exist in repository folders, but tabular loaders MUST ignore unsupported files unless explicitly requested by another loader implementation.

## Ownership and Plane Boundaries

### Control plane responsibilities

- Validate dataset registration and dataset-version publish commands.
- Persist metadata references to dataset_identity, dataset_version, and canonical repository base path.
- Enforce immutable version publication semantics.

### Training plane responsibilities

- Resolve dataset version path from immutable run metadata.
- Read split payloads using a batch iterator contract.
- Never mutate published files under Train, Val, or Test during training.

## Application and Infrastructure Contracts

### Domain-level concepts

- DatasetRepositoryRef
- DatasetVersionPath
- SplitName (Train, Val, Test)
- TabularBatchCursor

### Infrastructure interfaces

1. DataSetsFileSystemRepository
- create_dataset_version_layout(dataset_identity, dataset_version)
- list_split_files(dataset_identity, dataset_version, split)
- resolve_split_path(dataset_identity, dataset_version, split)
- verify_split_payload(dataset_identity, dataset_version, split)

2. TabularBatchLoader
- iter_batches(dataset_identity, dataset_version, split, batch_size, columns=None, shuffle=False, seed=None)
- count_rows(dataset_identity, dataset_version, split)

### Behavioral rules

- create_dataset_version_layout MUST fail if target dataset version path already exists.
- verify_split_payload MUST reject missing split directories.
- verify_split_payload MUST reject empty split directories for Train; Val and Test may be optional only if explicitly allowed by dataset configuration.
- iter_batches MUST provide deterministic ordering when shuffle is false.
- iter_batches MUST bound memory by reading in chunked batches instead of full-file in-memory loading.
- count_rows SHOULD be computed lazily and cached per file fingerprint when feasible.

## Validation and Error Handling

- Missing DATASETS_FS_ROOT path or inaccessible root MUST return a typed infrastructure error.
- Unsupported tabular file extension in active split MUST produce validation diagnostics with file path.
- Schema mismatch across files in the same split MUST produce validation diagnostics and block loader execution.
- Empty Train split MUST block run launch.

## Reproducibility and Lineage

Control plane run metadata MUST include immutable references:

- dataset_identity
- dataset_version
- repository_name=DataSets
- repository_base_path snapshot (resolved absolute path at run creation)
- split policy reference

These fields enable deterministic reconstruction of training inputs.

## Security and Operations

- Repository path traversal attempts MUST be rejected.
- Repository implementation MUST normalize and validate all path segments.
- Loader logs MUST not print full record content; only aggregate operational metrics are allowed.

## Non-Functional Constraints

- Local portability: implementation must run on Windows developer machines without POSIX-only assumptions.
- Reliability: batch iterator must safely close file handles between files/splits.
- Maintainability: keep repository and loader in dataset-management/infrastructure, with use-case orchestration in application layer.

## Open Decisions

- Whether Val and Test are mandatory for every tabular dataset version in MVP or configurable by dataset policy.
- Whether schema contract is inferred on publish or provided explicitly in registration metadata.
- Whether parquet and csv batching should share one polymorphic loader abstraction or separate adapters from day one.