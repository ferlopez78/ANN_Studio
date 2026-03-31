# DataSets Filesystem Repository (Tabular MVP)

This module provides a local filesystem repository and batch loader for tabular datasets.

## Canonical layout

DataSets/<dataset_identity>/<dataset_version>/Train/
DataSets/<dataset_identity>/<dataset_version>/Val/
DataSets/<dataset_identity>/<dataset_version>/Test/

## Main classes

- DataSetsFileSystemRepository
- TabularBatchLoader

## Supported tabular files

- .csv
- .parquet (requires pyarrow)

## Minimal usage

from features.dataset_management.infrastructure import DataSetsFileSystemRepository, TabularBatchLoader

repo = DataSetsFileSystemRepository("./DataSets")
repo.create_dataset_version_layout("churn", "v1")
repo.verify_split_payload("churn", "v1")

loader = TabularBatchLoader(repo)
for batch in loader.iter_batches("churn", "v1", "Train", batch_size=512, shuffle=False):
    # send batch to training pipeline
    pass
