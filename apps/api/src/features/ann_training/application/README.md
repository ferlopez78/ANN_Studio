# Tabular ANN Training Service

This module provides a single-process backend trainer for ANN on tabular data.

## What it does

- Receives a dataset folder path.
- Selects one tabular file to process (or fails if multiple and no selected_file is provided).
- Verifies ANN input compatibility from configured feature/target columns.
- Trains a configurable ANN with per-run parameters.

## Supported files

- .csv
- .parquet (requires pyarrow)

## Main entrypoint

- TabularAnnTrainingService.run(config)

## Minimal example

from features.ann_training.application import (
    LayerConfig,
    OptimizerConfig,
    EarlyStoppingConfig,
    TabularAnnTrainingConfig,
    TabularAnnTrainingService,
)

service = TabularAnnTrainingService()
result = service.run(
    TabularAnnTrainingConfig(
        dataset_path="./DataSets/churn/v1/Train",
        selected_file="train.csv",
        feature_columns=["age", "balance", "tenure"],
        target_columns=["churn"],
        task_type="binary_classification",
        hidden_layers=[
            LayerConfig(units=64, activation="relu", weight_initializer="he_uniform"),
            LayerConfig(units=32, activation="relu", weight_initializer="he_uniform"),
        ],
        output_units=1,
        output_activation="sigmoid",
        optimizer=OptimizerConfig(name="sgd", learning_rate=1e-2),
        epochs=100,
        batch_size=256,
        early_stopping=EarlyStoppingConfig(enabled=True, patience=12, min_delta=1e-4),
    )
)

print(result)
