from __future__ import annotations

import argparse
import json

from .tabular_ann_training import (
    EarlyStoppingConfig,
    LayerConfig,
    OptimizerConfig,
    TabularAnnTrainingConfig,
    TabularAnnTrainingService,
)


def _parse_layers(raw_layers: str) -> list[LayerConfig]:
    payload = json.loads(raw_layers)
    if not isinstance(payload, list):
        raise ValueError("--layers must be a JSON array")

    layers: list[LayerConfig] = []
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            raise ValueError(f"Layer at index {index} must be an object")
        layers.append(
            LayerConfig(
                units=int(item["units"]),
                activation=item.get("activation", "relu"),
                use_bias=bool(item.get("use_bias", True)),
                weight_initializer=item.get("weight_initializer", "xavier_uniform"),
            )
        )
    return layers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run tabular ANN training")
    parser.add_argument("--dataset-path", required=True)
    parser.add_argument("--selected-file", required=False)
    parser.add_argument("--features", required=True, help="Comma-separated feature columns")
    parser.add_argument("--targets", required=True, help="Comma-separated target columns")
    parser.add_argument(
        "--task-type",
        required=True,
        choices=["binary_classification", "multiclass_classification", "regression"],
    )
    parser.add_argument("--layers", required=True, help="JSON array. Example: [{\"units\":64,\"activation\":\"relu\"}]")
    parser.add_argument("--output-units", required=True, type=int)
    parser.add_argument("--output-activation", required=True)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=0.0)
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--no-shuffle-within-batch", action="store_true")
    parser.add_argument("--early-stop", action="store_true")
    parser.add_argument("--early-stop-patience", type=int, default=10)
    parser.add_argument("--early-stop-min-delta", type=float, default=1e-4)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    feature_columns = [value.strip() for value in args.features.split(",") if value.strip()]
    target_columns = [value.strip() for value in args.targets.split(",") if value.strip()]
    hidden_layers = _parse_layers(args.layers)

    config = TabularAnnTrainingConfig(
        dataset_path=args.dataset_path,
        selected_file=args.selected_file,
        feature_columns=feature_columns,
        target_columns=target_columns,
        task_type=args.task_type,
        hidden_layers=hidden_layers,
        output_units=args.output_units,
        output_activation=args.output_activation,
        optimizer=OptimizerConfig(
            name="sgd",
            learning_rate=args.learning_rate,
            weight_decay=args.weight_decay,
        ),
        epochs=args.epochs,
        batch_size=args.batch_size,
        shuffle_within_batch=not args.no_shuffle_within_batch,
        seed=args.seed,
        early_stopping=EarlyStoppingConfig(
            enabled=args.early_stop,
            patience=args.early_stop_patience,
            min_delta=args.early_stop_min_delta,
        ),
    )

    service = TabularAnnTrainingService()
    result = service.run(config)

    print("Training finished")
    print(f"Selected file: {result.selected_file}")
    print(f"Epochs completed: {result.epochs_completed}")
    print(f"Best epoch: {result.best_epoch}")
    print(f"Final train loss: {result.final_train_loss:.6f}")
    print(f"Final train {result.final_train_metric_name}: {result.final_train_metric:.6f}")
    if result.class_labels:
        print(f"Class labels: {', '.join(result.class_labels)}")


if __name__ == "__main__":
    main()
