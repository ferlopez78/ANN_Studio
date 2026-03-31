## Why

ANN Studio currently defines dataset metadata and versioning behavior, but it does not define a backend filesystem repository contract for dataset payloads.
For tabular training at MVP scale, the platform needs a deterministic storage layout and a streaming/batch read capability that avoids loading full large files into memory.

Without this contract:
- dataset payload organization is ad hoc across environments
- training ingestion for large tabular files is memory-risky
- reproducibility links between dataset version metadata and physical payload paths are underspecified

## Goals

- Define a backend filesystem repository named DataSets as the default local dataset payload store.
- Define canonical dataset payload layout using split-level folders under each dataset version.
- Define backend batch-loading capability for large tabular files.
- Preserve immutable dataset version behavior and lineage compatibility with existing MVP contracts.
- Keep this change scoped to tabular data ingestion first.

## Scope

### In scope
- Filesystem repository root and path contract for DataSets.
- Dataset-version folder naming and split folder structure.
- Accepted tabular file formats for MVP (CSV and Parquet).
- Batch loading interface contract for training consumption.
- Error handling and validation behavior for missing/invalid split content.
- Reproducibility linkage requirements between dataset version metadata and filesystem paths.

### Out of scope
- Object storage migration and synchronization strategy.
- CV-specific loaders and annotation parsing.
- Distributed sharding across multiple filesystem nodes.
- UI workflows beyond exposing split-level payload readiness status.

## Impact

- Adds a concrete backend data persistence contract under dataset-management.
- Enables implementation of infrastructure classes for local filesystem dataset storage and batch readers.
- Reduces memory pressure risk for large tabular dataset training flows.

## Open decisions

- Should the dataset version path segment be human-readable, ID-based, or both?
- Should MVP include optional gzip-compressed CSV support in the first loader iteration?
- What should be the default tabular batch size for local developer machines?