from __future__ import annotations

import csv
import importlib
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator, Literal, Optional, Sequence

import numpy as np

TaskType = Literal["binary_classification", "multiclass_classification", "regression"]
ActivationName = Literal["relu", "leaky_relu", "elu", "gelu", "tanh", "sigmoid", "linear", "softmax"]
InitializerName = Literal[
    "xavier_uniform",
    "xavier_normal",
    "he_uniform",
    "he_normal",
    "normal",
    "zeros",
]
OptimizerName = Literal["sgd", "adam", "adamw", "rmsprop", "nadam", "adagrad"]
SchedulerName = Literal["none", "cosineannealing", "reducelronplateau", "steplr", "onecyclelr", "exponentiallr"]


class AnnTrainingError(Exception):
    """Generic training pipeline error for tabular ANN service."""


@dataclass(frozen=True)
class LayerConfig:
    units: int
    activation: ActivationName = "relu"
    dropout: float = 0.0
    use_bias: bool = True
    weight_initializer: InitializerName = "xavier_uniform"


@dataclass(frozen=True)
class OptimizerConfig:
    name: OptimizerName = "sgd"
    learning_rate: float = 1e-3
    weight_decay: float = 0.0
    beta1: float = 0.9
    beta2: float = 0.999
    epsilon: float = 1e-8
    rho: float = 0.9


@dataclass(frozen=True)
class SchedulerConfig:
    name: SchedulerName = "none"
    gamma: float = 0.98
    step_size: int = 10
    min_learning_rate: float = 1e-6
    max_learning_rate: float = 3e-3
    warmup_ratio: float = 0.3
    plateau_patience: int = 5
    plateau_factor: float = 0.5


@dataclass(frozen=True)
class EarlyStoppingConfig:
    enabled: bool = False
    patience: int = 10
    min_delta: float = 1e-4


@dataclass(frozen=True)
class TabularAnnTrainingConfig:
    dataset_path: str
    selected_file: Optional[str] = None
    feature_columns: Sequence[str] = field(default_factory=list)
    target_columns: Sequence[str] = field(default_factory=list)
    task_type: TaskType = "binary_classification"
    hidden_layers: Sequence[LayerConfig] = field(default_factory=list)
    output_units: int = 1
    output_activation: ActivationName = "sigmoid"
    optimizer: OptimizerConfig = field(default_factory=OptimizerConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)
    epochs: int = 100
    batch_size: int = 128
    shuffle_within_batch: bool = True
    seed: int = 42
    early_stopping: EarlyStoppingConfig = field(default_factory=EarlyStoppingConfig)
    validation_features: Sequence[Sequence[float]] = field(default_factory=list)
    validation_targets: Sequence[Sequence[str]] = field(default_factory=list)


@dataclass
class TabularAnnTrainingResult:
    selected_file: str
    epochs_completed: int
    best_epoch: int
    train_losses: list[float]
    train_metrics: list[float]
    learning_rates: list[float]
    val_losses: list[float]
    val_metrics: list[float]
    val_confusion_matrices: list[list[list[int]]]
    final_train_loss: float
    final_train_metric_name: str
    final_train_metric: float
    class_labels: list[str]
    trained_layers: list[dict]


@dataclass
class _LayerState:
    w: np.ndarray
    b: np.ndarray
    activation: ActivationName
    dropout: float
    use_bias: bool
    m_w: np.ndarray | None = None
    m_b: np.ndarray | None = None
    v_w: np.ndarray | None = None
    v_b: np.ndarray | None = None
    acc_w: np.ndarray | None = None
    acc_b: np.ndarray | None = None


class _TabularFilePicker:
    def pick_file(self, dataset_path: str, selected_file: Optional[str]) -> Path:
        base_path = Path(dataset_path).expanduser().resolve()
        if not base_path.exists() or not base_path.is_dir():
            raise AnnTrainingError(f"Dataset path is not an existing directory: {base_path}")

        supported = [
            candidate
            for candidate in base_path.iterdir()
            if candidate.is_file() and candidate.suffix.lower() in (".csv", ".parquet")
        ]
        supported.sort(key=lambda value: value.name.lower())

        if not supported:
            raise AnnTrainingError(f"No supported tabular files (.csv, .parquet) in path: {base_path}")

        if selected_file:
            candidate = (base_path / selected_file).resolve()
            if candidate not in supported:
                names = ", ".join(file.name for file in supported)
                raise AnnTrainingError(
                    f"Selected file '{selected_file}' is not available or supported. Available files: {names}"
                )
            return candidate

        if len(supported) > 1:
            names = ", ".join(file.name for file in supported)
            raise AnnTrainingError(
                f"Multiple files found in dataset path. Provide selected_file. Available files: {names}"
            )

        return supported[0]


class _TabularBatchReader:
    def iter_batches(
        self,
        file_path: Path,
        feature_columns: Sequence[str],
        target_columns: Sequence[str],
        batch_size: int,
        shuffle_within_batch: bool,
        seed: int,
        epoch: int,
    ) -> Iterator[tuple[np.ndarray, np.ndarray, list[list[str]]]]:
        if file_path.suffix.lower() == ".csv":
            yield from self._iter_csv_batches(
                file_path=file_path,
                feature_columns=feature_columns,
                target_columns=target_columns,
                batch_size=batch_size,
                shuffle_within_batch=shuffle_within_batch,
                seed=seed,
                epoch=epoch,
            )
            return

        if file_path.suffix.lower() == ".parquet":
            yield from self._iter_parquet_batches(
                file_path=file_path,
                feature_columns=feature_columns,
                target_columns=target_columns,
                batch_size=batch_size,
                shuffle_within_batch=shuffle_within_batch,
                seed=seed,
                epoch=epoch,
            )
            return

        raise AnnTrainingError(f"Unsupported file extension: {file_path}")

    def _iter_csv_batches(
        self,
        file_path: Path,
        feature_columns: Sequence[str],
        target_columns: Sequence[str],
        batch_size: int,
        shuffle_within_batch: bool,
        seed: int,
        epoch: int,
    ) -> Iterator[tuple[np.ndarray, np.ndarray, list[list[str]]]]:
        rng = np.random.default_rng(seed + epoch)

        with file_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise AnnTrainingError(f"CSV has no header columns: {file_path}")

            missing = [column for column in [*feature_columns, *target_columns] if column not in reader.fieldnames]
            if missing:
                raise AnnTrainingError(
                    f"CSV file {file_path.name} missing required columns: {', '.join(missing)}"
                )

            batch_x: list[list[float]] = []
            batch_y: list[list[str]] = []
            for row in reader:
                try:
                    x_row = [float(row[column]) for column in feature_columns]
                except ValueError as exc:
                    raise AnnTrainingError(
                        "Input format is not ANN-compatible. Feature columns must be numeric. "
                        f"File: {file_path.name}"
                    ) from exc

                y_row = [row[column] for column in target_columns]
                batch_x.append(x_row)
                batch_y.append(y_row)

                if len(batch_x) == batch_size:
                    x_arr = np.asarray(batch_x, dtype=np.float64)
                    y_arr_raw = np.asarray(batch_y, dtype=object)
                    if shuffle_within_batch:
                        indices = np.arange(len(x_arr))
                        rng.shuffle(indices)
                        x_arr = x_arr[indices]
                        y_arr_raw = y_arr_raw[indices]

                    yield x_arr, np.zeros((len(x_arr), 1), dtype=np.float64), y_arr_raw.tolist()
                    batch_x = []
                    batch_y = []

            if batch_x:
                x_arr = np.asarray(batch_x, dtype=np.float64)
                y_arr_raw = np.asarray(batch_y, dtype=object)
                if shuffle_within_batch:
                    indices = np.arange(len(x_arr))
                    rng.shuffle(indices)
                    x_arr = x_arr[indices]
                    y_arr_raw = y_arr_raw[indices]

                yield x_arr, np.zeros((len(x_arr), 1), dtype=np.float64), y_arr_raw.tolist()

    def _iter_parquet_batches(
        self,
        file_path: Path,
        feature_columns: Sequence[str],
        target_columns: Sequence[str],
        batch_size: int,
        shuffle_within_batch: bool,
        seed: int,
        epoch: int,
    ) -> Iterator[tuple[np.ndarray, np.ndarray, list[list[str]]]]:
        try:
            pq = importlib.import_module("pyarrow.parquet")
        except Exception as exc:
            raise AnnTrainingError("pyarrow is required for parquet training") from exc

        rng = np.random.default_rng(seed + epoch)
        parquet = pq.ParquetFile(file_path)
        requested = [*feature_columns, *target_columns]

        for record_batch in parquet.iter_batches(batch_size=batch_size, columns=requested):
            rows = record_batch.to_pylist()
            if not rows:
                continue

            try:
                x_arr = np.asarray(
                    [[float(row[column]) for column in feature_columns] for row in rows],
                    dtype=np.float64,
                )
            except ValueError as exc:
                raise AnnTrainingError(
                    "Input format is not ANN-compatible. Feature columns must be numeric. "
                    f"File: {file_path.name}"
                ) from exc

            y_raw = [[str(row[column]) for column in target_columns] for row in rows]
            if shuffle_within_batch:
                indices = np.arange(len(x_arr))
                rng.shuffle(indices)
                x_arr = x_arr[indices]
                y_raw = [y_raw[int(index)] for index in indices]

            yield x_arr, np.zeros((len(x_arr), 1), dtype=np.float64), y_raw


class TabularAnnTrainingService:
    """Single-process ANN trainer for generic tabular datasets.

    This service supports:
    - file selection when dataset path has multiple files
    - dataset compatibility checks against ANN configuration
    - configurable architecture, initialization, bias usage, optimizer settings,
      learning rate, epochs, and early stopping
    """

    def __init__(self) -> None:
        self._picker = _TabularFilePicker()
        self._reader = _TabularBatchReader()
        self._optimizer_step = 0

    def run(self, config: TabularAnnTrainingConfig) -> TabularAnnTrainingResult:
        self._validate_config(config)
        selected_file = self._picker.pick_file(config.dataset_path, config.selected_file)

        class_labels = self._collect_class_labels(selected_file, config)
        layers = self._initialize_layers(config)
        best_loss = math.inf
        best_epoch = 0
        best_layers_snapshot: list[_LayerState] = []
        train_losses: list[float] = []
        train_metrics: list[float] = []
        learning_rates: list[float] = []
        val_losses: list[float] = []
        val_metrics: list[float] = []
        val_confusion_matrices: list[list[list[int]]] = []
        final_metric_name = "accuracy"
        final_metric = 0.0
        class_index = {value: index for index, value in enumerate(class_labels)}
        self._optimizer_step = 0

        for epoch in range(config.epochs):
            current_lr = self._resolve_learning_rate(config, epoch, val_losses)
            epoch_loss, metric_name, metric_value = self._train_one_epoch(
                selected_file=selected_file,
                config=config,
                class_labels=class_labels,
                class_index=class_index,
                layers=layers,
                epoch=epoch,
                learning_rate=current_lr,
            )
            train_losses.append(epoch_loss)
            train_metrics.append(metric_value)
            learning_rates.append(current_lr)
            val_loss, val_metric, val_confusion = self._evaluate_validation(config, class_labels, class_index, layers)
            val_losses.append(val_loss)
            val_metrics.append(val_metric)
            val_confusion_matrices.append(val_confusion)
            final_metric_name = metric_name
            final_metric = metric_value

            improved = best_loss - val_loss > config.early_stopping.min_delta
            if improved:
                best_loss = val_loss
                best_epoch = epoch + 1
                best_layers_snapshot = [self._clone_layer_state(layer) for layer in layers]

            if config.early_stopping.enabled and not improved:
                stale_epochs = (epoch + 1) - best_epoch
                if stale_epochs >= config.early_stopping.patience:
                    if best_layers_snapshot:
                        layers = [
                            _LayerState(
                                w=np.copy(layer.w),
                                b=np.copy(layer.b),
                                activation=layer.activation,
                                dropout=layer.dropout,
                                use_bias=layer.use_bias,
                            )
                            for layer in best_layers_snapshot
                        ]
                    return TabularAnnTrainingResult(
                        selected_file=selected_file.name,
                        epochs_completed=epoch + 1,
                        best_epoch=best_epoch,
                        train_losses=train_losses,
                        train_metrics=train_metrics,
                        learning_rates=learning_rates,
                        val_losses=val_losses,
                        val_metrics=val_metrics,
                        val_confusion_matrices=val_confusion_matrices,
                        final_train_loss=float(train_losses[-1]),
                        final_train_metric_name=final_metric_name,
                        final_train_metric=float(final_metric),
                        class_labels=class_labels,
                        trained_layers=self._export_layers(layers),
                    )

        return TabularAnnTrainingResult(
            selected_file=selected_file.name,
            epochs_completed=config.epochs,
            best_epoch=best_epoch if best_epoch > 0 else config.epochs,
            train_losses=train_losses,
            train_metrics=train_metrics,
            learning_rates=learning_rates,
            val_losses=val_losses,
            val_metrics=val_metrics,
            val_confusion_matrices=val_confusion_matrices,
            final_train_loss=float(train_losses[-1]) if train_losses else 0.0,
            final_train_metric_name=final_metric_name,
            final_train_metric=float(final_metric),
            class_labels=class_labels,
            trained_layers=self._export_layers(layers),
        )

    def _export_layers(self, layers: Sequence[_LayerState]) -> list[dict]:
        return [
            {
                "weights": layer.w.tolist(),
                "bias": layer.b.tolist(),
                "activation": layer.activation,
                "dropout": layer.dropout,
                "use_bias": layer.use_bias,
            }
            for layer in layers
        ]

    def _clone_layer_state(self, layer: _LayerState) -> _LayerState:
        return _LayerState(
            w=np.copy(layer.w),
            b=np.copy(layer.b),
            activation=layer.activation,
            dropout=layer.dropout,
            use_bias=layer.use_bias,
            m_w=np.copy(layer.m_w) if layer.m_w is not None else None,
            m_b=np.copy(layer.m_b) if layer.m_b is not None else None,
            v_w=np.copy(layer.v_w) if layer.v_w is not None else None,
            v_b=np.copy(layer.v_b) if layer.v_b is not None else None,
            acc_w=np.copy(layer.acc_w) if layer.acc_w is not None else None,
            acc_b=np.copy(layer.acc_b) if layer.acc_b is not None else None,
        )

    def _resolve_learning_rate(self, config: TabularAnnTrainingConfig, epoch: int, val_losses: Sequence[float]) -> float:
        base_lr = config.optimizer.learning_rate
        scheduler = config.scheduler
        name = scheduler.name

        if name == "none":
            return base_lr

        if name == "steplr":
            factor = scheduler.gamma ** (epoch // max(1, scheduler.step_size))
            return max(scheduler.min_learning_rate, base_lr * factor)

        if name == "exponentiallr":
            factor = scheduler.gamma ** epoch
            return max(scheduler.min_learning_rate, base_lr * factor)

        if name == "cosineannealing":
            if config.epochs <= 1:
                return base_lr
            cosine = 0.5 * (1 + math.cos(math.pi * epoch / (config.epochs - 1)))
            return scheduler.min_learning_rate + (base_lr - scheduler.min_learning_rate) * cosine

        if name == "onecyclelr":
            max_lr = max(base_lr, scheduler.max_learning_rate)
            warm_epochs = max(1, int(config.epochs * scheduler.warmup_ratio))
            if epoch < warm_epochs:
                progress = epoch / warm_epochs
                return base_lr + (max_lr - base_lr) * progress
            cool_epochs = max(1, config.epochs - warm_epochs)
            cool_progress = (epoch - warm_epochs) / cool_epochs
            return max(scheduler.min_learning_rate, max_lr - (max_lr - scheduler.min_learning_rate) * cool_progress)

        if name == "reducelronplateau":
            if len(val_losses) <= scheduler.plateau_patience:
                return base_lr

            best_loss = min(val_losses)
            stale = 0
            for value in reversed(val_losses):
                if value <= best_loss + 1e-10:
                    break
                stale += 1

            decay_steps = stale // max(1, scheduler.plateau_patience)
            return max(scheduler.min_learning_rate, base_lr * (scheduler.plateau_factor**decay_steps))

        raise AnnTrainingError(f"Unsupported scheduler: {name}")

    def _collect_class_labels(self, selected_file: Path, config: TabularAnnTrainingConfig) -> list[str]:
        labels: set[str] = set()
        batch_counter = 0

        for _, _, raw_targets in self._reader.iter_batches(
            file_path=selected_file,
            feature_columns=config.feature_columns,
            target_columns=config.target_columns,
            batch_size=max(2048, config.batch_size),
            shuffle_within_batch=False,
            seed=config.seed,
            epoch=0,
        ):
            batch_counter += 1
            labels.update([row[0] for row in raw_targets])
            if config.task_type == "binary_classification" and len(labels) > 2:
                raise AnnTrainingError(
                    "Target format is not compatible with binary ANN output. More than two classes found."
                )

        if batch_counter == 0:
            raise AnnTrainingError("Selected dataset file has no rows to train.")

        if config.task_type == "binary_classification":
            if len(labels) != 2:
                raise AnnTrainingError(
                    "Binary ANN requires exactly two target classes."
                )
            if config.output_units != 1:
                raise AnnTrainingError("Binary ANN requires output_units = 1.")
            return sorted(labels)

        if config.task_type == "multiclass_classification":
            if len(labels) < 2:
                raise AnnTrainingError("Multiclass ANN requires at least two classes.")
            if config.output_units != len(labels):
                raise AnnTrainingError(
                    f"Output units ({config.output_units}) must match number of classes ({len(labels)})."
                )
            return sorted(labels)

        if config.task_type == "regression":
            if len(config.target_columns) != config.output_units:
                raise AnnTrainingError(
                    f"Regression ANN requires output_units = len(target_columns) ({len(config.target_columns)})."
                )
            return []

        raise AnnTrainingError(f"Unsupported task type: {config.task_type}")

    def _train_one_epoch(
        self,
        selected_file: Path,
        config: TabularAnnTrainingConfig,
        class_labels: Sequence[str],
        class_index: dict[str, int],
        layers: list[_LayerState],
        epoch: int,
        learning_rate: float,
    ) -> tuple[float, str, float]:
        losses: list[float] = []
        total_samples = 0
        total_correct = 0
        regression_abs_error = 0.0
        for x_batch, _, y_raw in self._reader.iter_batches(
            file_path=selected_file,
            feature_columns=config.feature_columns,
            target_columns=config.target_columns,
            batch_size=config.batch_size,
            shuffle_within_batch=config.shuffle_within_batch,
            seed=config.seed,
            epoch=epoch,
        ):
            y_batch = self._encode_targets(config, y_raw, class_index)
            rng = np.random.default_rng(config.seed + (epoch + 1) * 9973 + total_samples + len(x_batch))
            activations, pre_activations, dropout_masks = self._forward(layers, x_batch, training=True, rng=rng)
            y_pred = activations[-1]

            loss_value, dloss = self._loss_and_gradient(config.task_type, y_batch, y_pred)
            losses.append(float(loss_value))

            grads_w, grads_b = self._backward(
                layers=layers,
                activations=activations,
                pre_activations=pre_activations,
                dropout_masks=dropout_masks,
                dloss=dloss,
                skip_output_activation_derivative=config.task_type != "regression",
            )
            self._apply_gradients(layers, grads_w, grads_b, config.optimizer, learning_rate)

            batch_size = len(x_batch)
            total_samples += batch_size
            if config.task_type in ("binary_classification", "multiclass_classification"):
                total_correct += self._count_correct_predictions(config.task_type, y_batch, y_pred)
            else:
                regression_abs_error += float(np.sum(np.abs(y_pred - y_batch)))

        if not losses:
            raise AnnTrainingError("No batches produced during epoch training.")

        avg_loss = float(np.mean(losses))
        if config.task_type in ("binary_classification", "multiclass_classification"):
            accuracy = float(total_correct / max(total_samples, 1))
            return avg_loss, "accuracy", accuracy

        mae = float(regression_abs_error / max(total_samples, 1))
        return avg_loss, "mae", mae

    def _evaluate_validation(
        self,
        config: TabularAnnTrainingConfig,
        class_labels: Sequence[str],
        class_index: dict[str, int],
        layers: Sequence[_LayerState],
    ) -> tuple[float, float, list[list[int]]]:
        if not config.validation_features or not config.validation_targets:
            # Fallbacks keep API stable if validation rows are not available.
            size = len(class_labels) if config.task_type == "multiclass_classification" else 2
            return 0.0, 0.0, [[0 for _ in range(size)] for _ in range(size)]

        try:
            x_val = np.asarray(config.validation_features, dtype=np.float64)
        except ValueError as exc:
            raise AnnTrainingError("Validation feature values must be numeric.") from exc

        y_true = self._encode_targets(config.task_type, config.validation_targets, class_index)
        activations, _, _ = self._forward(layers, x_val, training=False, rng=None)
        y_pred = activations[-1]
        loss, _ = self._loss_and_gradient(config.task_type, y_true, y_pred)

        if config.task_type == "regression":
            mae = float(np.mean(np.abs(y_pred - y_true)))
            return float(loss), mae, [[0, 0], [0, 0]]

        metric = float(self._count_correct_predictions(config.task_type, y_true, y_pred) / max(len(x_val), 1))
        confusion = self._build_confusion_matrix(config.task_type, y_true, y_pred)
        return float(loss), metric, confusion

    def _build_confusion_matrix(self, task_type: TaskType, y_true: np.ndarray, y_pred: np.ndarray) -> list[list[int]]:
        if task_type == "binary_classification":
            truth = y_true.reshape(-1).astype(np.int64)
            pred = (y_pred.reshape(-1) >= 0.5).astype(np.int64)
            matrix = [[0, 0], [0, 0]]
            for t, p in zip(truth, pred):
                matrix[int(t)][int(p)] += 1
            return matrix

        if task_type == "multiclass_classification":
            truth = np.argmax(y_true, axis=1)
            pred = np.argmax(y_pred, axis=1)
            size = int(y_true.shape[1])
            matrix = [[0 for _ in range(size)] for _ in range(size)]
            for t, p in zip(truth, pred):
                matrix[int(t)][int(p)] += 1
            return matrix

        return [[0, 0], [0, 0]]

    def _encode_targets(
        self,
        task_type: TaskType,
        raw_targets: Sequence[Sequence[str]],
        class_index: dict[str, int],
    ) -> np.ndarray:
        if task_type == "binary_classification":
            positive = sorted(class_index.keys())[1]
            for value_row in raw_targets:
                if value_row[0] not in class_index:
                    raise AnnTrainingError(f"Unknown class label in target: {value_row[0]}")
            values = np.asarray(
                [[1.0 if value_row[0] == positive else 0.0] for value_row in raw_targets],
                dtype=np.float64,
            )
            return values

        if task_type == "multiclass_classification":
            output = np.zeros((len(raw_targets), len(class_index)), dtype=np.float64)
            for row_idx, value_row in enumerate(raw_targets):
                if value_row[0] not in class_index:
                    raise AnnTrainingError(f"Unknown class label in target: {value_row[0]}")
                output[row_idx, class_index[value_row[0]]] = 1.0
            return output

        try:
            values = np.asarray(
                [[float(value) for value in value_row] for value_row in raw_targets],
                dtype=np.float64,
            )
            return values
        except ValueError as exc:
            raise AnnTrainingError("Regression target must be numeric.") from exc

    def _initialize_layers(self, config: TabularAnnTrainingConfig) -> list[_LayerState]:
        rng = np.random.default_rng(config.seed)
        layout = [
            config.hidden_layers[index] if index < len(config.hidden_layers) else LayerConfig(units=config.output_units)
            for index in range(len(config.hidden_layers) + 1)
        ]

        sizes = [len(config.feature_columns), *[layer.units for layer in config.hidden_layers], config.output_units]
        layers: list[_LayerState] = []

        for layer_index in range(len(sizes) - 1):
            in_dim = sizes[layer_index]
            out_dim = sizes[layer_index + 1]
            layer_cfg = layout[layer_index]
            activation = layer_cfg.activation if layer_index < len(config.hidden_layers) else config.output_activation
            dropout = layer_cfg.dropout if layer_index < len(config.hidden_layers) else 0.0

            weights = self._init_weights(
                rng=rng,
                initializer=layer_cfg.weight_initializer,
                in_dim=in_dim,
                out_dim=out_dim,
            )
            bias = np.zeros((1, out_dim), dtype=np.float64) if layer_cfg.use_bias else np.zeros((1, out_dim), dtype=np.float64)

            layers.append(_LayerState(w=weights, b=bias, activation=activation, dropout=dropout, use_bias=layer_cfg.use_bias))

        return layers

    def _forward(
        self,
        layers: Sequence[_LayerState],
        x: np.ndarray,
        training: bool,
        rng: np.random.Generator | None,
    ) -> tuple[list[np.ndarray], list[np.ndarray], list[np.ndarray | None]]:
        activations = [x]
        pre_activations: list[np.ndarray] = []
        dropout_masks: list[np.ndarray | None] = []

        for index, layer in enumerate(layers):
            z = activations[-1] @ layer.w + (layer.b if layer.use_bias else 0.0)
            a = self._activate(layer.activation, z)

            mask: np.ndarray | None = None
            is_output = index == len(layers) - 1
            if training and not is_output and layer.dropout > 0:
                if rng is None:
                    rng = np.random.default_rng()
                keep_probability = max(1e-8, 1.0 - layer.dropout)
                mask = (rng.random(a.shape) < keep_probability).astype(np.float64) / keep_probability
                a = a * mask

            pre_activations.append(z)
            activations.append(a)
            dropout_masks.append(mask)

        return activations, pre_activations, dropout_masks

    def _backward(
        self,
        layers: Sequence[_LayerState],
        activations: Sequence[np.ndarray],
        pre_activations: Sequence[np.ndarray],
        dropout_masks: Sequence[np.ndarray | None],
        dloss: np.ndarray,
        skip_output_activation_derivative: bool,
    ) -> tuple[list[np.ndarray], list[np.ndarray]]:
        grads_w: list[np.ndarray] = [np.zeros_like(layer.w) for layer in layers]
        grads_b: list[np.ndarray] = [np.zeros_like(layer.b) for layer in layers]

        delta = dloss
        for idx in range(len(layers) - 1, -1, -1):
            layer = layers[idx]
            z = pre_activations[idx]
            a_prev = activations[idx]
            is_output = idx == len(layers) - 1

            if not is_output and dropout_masks[idx] is not None:
                delta = delta * dropout_masks[idx]

            if not (is_output and skip_output_activation_derivative):
                delta = delta * self._activation_derivative(layer.activation, z)

            grads_w[idx] = (a_prev.T @ delta) / max(len(a_prev), 1)
            if layer.use_bias:
                grads_b[idx] = np.mean(delta, axis=0, keepdims=True)
            else:
                grads_b[idx] = np.zeros_like(layer.b)

            if idx > 0:
                delta = delta @ layer.w.T

        return grads_w, grads_b

    def _apply_gradients(
        self,
        layers: Sequence[_LayerState],
        grads_w: Sequence[np.ndarray],
        grads_b: Sequence[np.ndarray],
        optimizer: OptimizerConfig,
        learning_rate: float,
    ) -> None:
        self._optimizer_step += 1
        step = self._optimizer_step

        for idx, layer in enumerate(layers):
            grad_w = grads_w[idx]
            grad_b = grads_b[idx]

            if optimizer.name == "sgd":
                wd_term = optimizer.weight_decay * layer.w if optimizer.weight_decay > 0 else 0.0
                layer.w -= learning_rate * (grad_w + wd_term)
                if layer.use_bias:
                    layer.b -= learning_rate * grad_b
                continue

            if optimizer.name == "adagrad":
                if layer.acc_w is None:
                    layer.acc_w = np.zeros_like(layer.w)
                if layer.acc_b is None:
                    layer.acc_b = np.zeros_like(layer.b)

                reg_grad_w = grad_w + optimizer.weight_decay * layer.w
                layer.acc_w += reg_grad_w**2
                if layer.use_bias:
                    layer.acc_b += grad_b**2

                layer.w -= learning_rate * reg_grad_w / (np.sqrt(layer.acc_w) + optimizer.epsilon)
                if layer.use_bias:
                    layer.b -= learning_rate * grad_b / (np.sqrt(layer.acc_b) + optimizer.epsilon)
                continue

            if optimizer.name == "rmsprop":
                if layer.v_w is None:
                    layer.v_w = np.zeros_like(layer.w)
                if layer.v_b is None:
                    layer.v_b = np.zeros_like(layer.b)

                reg_grad_w = grad_w + optimizer.weight_decay * layer.w
                layer.v_w = optimizer.rho * layer.v_w + (1 - optimizer.rho) * (reg_grad_w**2)
                if layer.use_bias:
                    layer.v_b = optimizer.rho * layer.v_b + (1 - optimizer.rho) * (grad_b**2)

                layer.w -= learning_rate * reg_grad_w / (np.sqrt(layer.v_w) + optimizer.epsilon)
                if layer.use_bias:
                    layer.b -= learning_rate * grad_b / (np.sqrt(layer.v_b) + optimizer.epsilon)
                continue

            if optimizer.name in ("adam", "adamw", "nadam"):
                if layer.m_w is None:
                    layer.m_w = np.zeros_like(layer.w)
                if layer.v_w is None:
                    layer.v_w = np.zeros_like(layer.w)
                if layer.m_b is None:
                    layer.m_b = np.zeros_like(layer.b)
                if layer.v_b is None:
                    layer.v_b = np.zeros_like(layer.b)

                reg_grad_w = grad_w if optimizer.name == "adamw" else grad_w + optimizer.weight_decay * layer.w

                layer.m_w = optimizer.beta1 * layer.m_w + (1 - optimizer.beta1) * reg_grad_w
                layer.v_w = optimizer.beta2 * layer.v_w + (1 - optimizer.beta2) * (reg_grad_w**2)

                m_w_hat = layer.m_w / (1 - optimizer.beta1**step)
                v_w_hat = layer.v_w / (1 - optimizer.beta2**step)

                if optimizer.name == "nadam":
                    m_w_hat = optimizer.beta1 * m_w_hat + ((1 - optimizer.beta1) * reg_grad_w) / (1 - optimizer.beta1**step)

                if optimizer.name == "adamw" and optimizer.weight_decay > 0:
                    layer.w -= learning_rate * optimizer.weight_decay * layer.w
                layer.w -= learning_rate * m_w_hat / (np.sqrt(v_w_hat) + optimizer.epsilon)

                if layer.use_bias:
                    layer.m_b = optimizer.beta1 * layer.m_b + (1 - optimizer.beta1) * grad_b
                    layer.v_b = optimizer.beta2 * layer.v_b + (1 - optimizer.beta2) * (grad_b**2)
                    m_b_hat = layer.m_b / (1 - optimizer.beta1**step)
                    v_b_hat = layer.v_b / (1 - optimizer.beta2**step)
                    if optimizer.name == "nadam":
                        m_b_hat = optimizer.beta1 * m_b_hat + ((1 - optimizer.beta1) * grad_b) / (1 - optimizer.beta1**step)
                    layer.b -= learning_rate * m_b_hat / (np.sqrt(v_b_hat) + optimizer.epsilon)
                continue

            raise AnnTrainingError(f"Unsupported optimizer: {optimizer.name}")

    def _loss_and_gradient(self, task_type: TaskType, y_true: np.ndarray, y_pred: np.ndarray) -> tuple[float, np.ndarray]:
        eps = 1e-8

        if task_type == "binary_classification":
            y = np.clip(y_pred, eps, 1.0 - eps)
            loss = -np.mean(y_true * np.log(y) + (1 - y_true) * np.log(1 - y))
            grad = (y - y_true) / max(len(y_true), 1)
            return float(loss), grad

        if task_type == "multiclass_classification":
            y = np.clip(y_pred, eps, 1.0)
            y = y / np.sum(y, axis=1, keepdims=True)
            loss = -np.mean(np.sum(y_true * np.log(y), axis=1))
            grad = (y - y_true) / max(len(y_true), 1)
            return float(loss), grad

        loss = np.mean((y_pred - y_true) ** 2)
        grad = 2.0 * (y_pred - y_true) / max(len(y_true), 1)
        return float(loss), grad

    def _count_correct_predictions(self, task_type: TaskType, y_true: np.ndarray, y_pred: np.ndarray) -> int:
        if task_type == "binary_classification":
            pred = (y_pred >= 0.5).astype(np.int64)
            truth = y_true.astype(np.int64)
            return int(np.sum(pred == truth))

        pred = np.argmax(y_pred, axis=1)
        truth = np.argmax(y_true, axis=1)
        return int(np.sum(pred == truth))

    def _activate(self, activation: ActivationName, x: np.ndarray) -> np.ndarray:
        if activation == "relu":
            return np.maximum(0.0, x)
        if activation == "leaky_relu":
            return np.where(x > 0, x, 0.01 * x)
        if activation == "elu":
            return np.where(x > 0, x, np.exp(x) - 1.0)
        if activation == "gelu":
            return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x**3)))
        if activation == "tanh":
            return np.tanh(x)
        if activation == "sigmoid":
            return 1.0 / (1.0 + np.exp(-x))
        if activation == "linear":
            return x
        if activation == "softmax":
            shifted = x - np.max(x, axis=1, keepdims=True)
            expo = np.exp(shifted)
            return expo / np.sum(expo, axis=1, keepdims=True)
        raise AnnTrainingError(f"Unsupported activation: {activation}")

    def _activation_derivative(self, activation: ActivationName, x: np.ndarray) -> np.ndarray:
        if activation == "relu":
            return (x > 0).astype(np.float64)
        if activation == "leaky_relu":
            return np.where(x > 0, 1.0, 0.01)
        if activation == "elu":
            return np.where(x > 0, 1.0, np.exp(x))
        if activation == "gelu":
            tanh_term = np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x**3))
            left = 0.5 * (1.0 + tanh_term)
            right = 0.5 * x * (1.0 - tanh_term**2) * np.sqrt(2.0 / np.pi) * (1.0 + 3.0 * 0.044715 * x**2)
            return left + right
        if activation == "tanh":
            return 1.0 - np.tanh(x) ** 2
        if activation == "sigmoid":
            sig = 1.0 / (1.0 + np.exp(-x))
            return sig * (1.0 - sig)
        if activation == "linear":
            return np.ones_like(x)
        if activation == "softmax":
            return np.ones_like(x)
        raise AnnTrainingError(f"Unsupported activation derivative: {activation}")

    def _init_weights(self, rng: np.random.Generator, initializer: InitializerName, in_dim: int, out_dim: int) -> np.ndarray:
        if initializer == "xavier_uniform":
            limit = math.sqrt(6.0 / (in_dim + out_dim))
            return rng.uniform(-limit, limit, size=(in_dim, out_dim)).astype(np.float64)
        if initializer == "xavier_normal":
            std = math.sqrt(2.0 / (in_dim + out_dim))
            return rng.normal(0.0, std, size=(in_dim, out_dim)).astype(np.float64)
        if initializer == "he_uniform":
            limit = math.sqrt(6.0 / in_dim)
            return rng.uniform(-limit, limit, size=(in_dim, out_dim)).astype(np.float64)
        if initializer == "he_normal":
            std = math.sqrt(2.0 / in_dim)
            return rng.normal(0.0, std, size=(in_dim, out_dim)).astype(np.float64)
        if initializer == "normal":
            return rng.normal(0.0, 0.01, size=(in_dim, out_dim)).astype(np.float64)
        if initializer == "zeros":
            return np.zeros((in_dim, out_dim), dtype=np.float64)
        raise AnnTrainingError(f"Unsupported initializer: {initializer}")

    def _validate_config(self, config: TabularAnnTrainingConfig) -> None:
        if not config.feature_columns:
            raise AnnTrainingError("feature_columns cannot be empty.")
        if not config.target_columns:
            raise AnnTrainingError("target_columns cannot be empty.")
        if config.epochs <= 0:
            raise AnnTrainingError("epochs must be > 0")
        if config.batch_size <= 0:
            raise AnnTrainingError("batch_size must be > 0")
        if config.optimizer.learning_rate <= 0:
            raise AnnTrainingError("learning_rate must be > 0")
        if config.output_units <= 0:
            raise AnnTrainingError("output_units must be > 0")
        if config.early_stopping.enabled and config.early_stopping.patience <= 0:
            raise AnnTrainingError("early_stopping patience must be > 0")

        if config.task_type == "binary_classification" and config.output_activation != "sigmoid":
            raise AnnTrainingError("binary_classification requires output_activation = sigmoid")
        if config.task_type == "multiclass_classification" and config.output_activation != "softmax":
            raise AnnTrainingError("multiclass_classification requires output_activation = softmax")
        if config.task_type == "regression" and config.output_activation not in ("linear", "sigmoid"):
            raise AnnTrainingError("regression requires output_activation = linear or sigmoid")

        for idx, layer in enumerate(config.hidden_layers):
            if layer.units <= 0:
                raise AnnTrainingError(f"hidden layer {idx + 1} units must be > 0")
            if layer.dropout < 0 or layer.dropout >= 1:
                raise AnnTrainingError(f"hidden layer {idx + 1} dropout must be in [0, 1)")

        if config.optimizer.name not in ("sgd", "adam", "adamw", "rmsprop", "nadam", "adagrad"):
            raise AnnTrainingError(f"Unsupported optimizer: {config.optimizer.name}")

        if config.scheduler.name not in ("none", "cosineannealing", "reducelronplateau", "steplr", "onecyclelr", "exponentiallr"):
            raise AnnTrainingError(f"Unsupported scheduler: {config.scheduler.name}")
