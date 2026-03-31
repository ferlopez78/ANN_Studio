from __future__ import annotations

import csv
import importlib
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Sequence

_SPLITS: tuple[str, str, str] = ("Train", "Val", "Test")
_ALLOWED_TABULAR_EXTENSIONS: tuple[str, str] = (".csv", ".parquet")
_SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


class DataSetsRepositoryError(Exception):
    """Base infrastructure exception for DataSets repository operations."""


class DataSetsValidationError(DataSetsRepositoryError):
    """Validation exception for split layout and tabular payload checks."""


@dataclass(frozen=True)
class SplitReadiness:
    split: str
    path: Path
    exists: bool
    files: int


class DataSetsFileSystemRepository:
    """Filesystem repository contract for DataSets/<dataset>/<version>/<split>."""

    def __init__(self, root_path: Path | str = "./DataSets") -> None:
        self._root_path = Path(root_path).resolve()

    @property
    def root_path(self) -> Path:
        return self._root_path

    def create_dataset_version_layout(self, dataset_identity: str, dataset_version: str) -> Path:
        base = self._dataset_version_path(dataset_identity, dataset_version)
        if base.exists():
            raise DataSetsValidationError(
                f"Dataset version path already exists and is immutable: {base}"
            )

        for split in _SPLITS:
            (base / split).mkdir(parents=True, exist_ok=False)

        return base

    def resolve_split_path(self, dataset_identity: str, dataset_version: str, split: str) -> Path:
        split_name = self._normalize_split(split)
        path = self._dataset_version_path(dataset_identity, dataset_version) / split_name
        self._validate_path_is_under_root(path)
        return path

    def list_split_files(
        self,
        dataset_identity: str,
        dataset_version: str,
        split: str,
        allowed_extensions: Optional[Sequence[str]] = None,
    ) -> List[Path]:
        split_path = self.resolve_split_path(dataset_identity, dataset_version, split)
        if not split_path.exists():
            return []

        extensions = tuple(ext.lower() for ext in (allowed_extensions or _ALLOWED_TABULAR_EXTENSIONS))
        files = [
            candidate
            for candidate in split_path.iterdir()
            if candidate.is_file() and candidate.suffix.lower() in extensions
        ]
        files.sort(key=lambda value: value.name.lower())
        return files

    def verify_split_payload(
        self,
        dataset_identity: str,
        dataset_version: str,
        required_splits: Iterable[str] = _SPLITS,
        require_non_empty_train: bool = True,
    ) -> Dict[str, SplitReadiness]:
        readiness: Dict[str, SplitReadiness] = {}
        required = [self._normalize_split(split) for split in required_splits]

        for split in required:
            split_path = self.resolve_split_path(dataset_identity, dataset_version, split)
            exists = split_path.exists() and split_path.is_dir()
            files = len(self.list_split_files(dataset_identity, dataset_version, split)) if exists else 0
            readiness[split] = SplitReadiness(split=split, path=split_path, exists=exists, files=files)

            if not exists:
                raise DataSetsValidationError(f"Missing required split directory: {split_path}")

        if require_non_empty_train:
            train = readiness.get("Train")
            if train and train.files == 0:
                raise DataSetsValidationError(f"Train split has no supported tabular files: {train.path}")

        return readiness

    def _dataset_version_path(self, dataset_identity: str, dataset_version: str) -> Path:
        identity = self._sanitize_segment(dataset_identity, field="dataset_identity")
        version = self._sanitize_segment(dataset_version, field="dataset_version")
        path = self._root_path / identity / version
        self._validate_path_is_under_root(path)
        return path

    @staticmethod
    def _normalize_split(split: str) -> str:
        value = split.strip().lower()
        mapping = {"train": "Train", "val": "Val", "test": "Test"}
        if value not in mapping:
            raise DataSetsValidationError(f"Invalid split name: {split}")
        return mapping[value]

    @staticmethod
    def _sanitize_segment(value: str, field: str) -> str:
        text = value.strip()
        if not text:
            raise DataSetsValidationError(f"{field} cannot be empty")
        if not _SEGMENT_PATTERN.match(text):
            raise DataSetsValidationError(
                f"{field} contains unsupported characters. Allowed: A-Z, a-z, 0-9, dot, dash, underscore"
            )
        return text

    def _validate_path_is_under_root(self, path: Path) -> None:
        resolved = path.resolve()
        if self._root_path not in resolved.parents and resolved != self._root_path:
            raise DataSetsValidationError(f"Path traversal rejected: {resolved}")


class TabularBatchLoader:
    """Batch iterator for tabular files in DataSets repository.

    Shuffle behavior is deterministic per seed. To keep memory bounded, batches are shuffled
    in-memory at chunk level, and files are processed in deterministic seeded order.
    """

    def __init__(self, repository: DataSetsFileSystemRepository) -> None:
        self._repository = repository

    def iter_batches(
        self,
        dataset_identity: str,
        dataset_version: str,
        split: str,
        batch_size: int,
        columns: Optional[Sequence[str]] = None,
        shuffle: bool = False,
        seed: Optional[int] = None,
    ) -> Iterator[List[dict]]:
        if batch_size <= 0:
            raise DataSetsValidationError("batch_size must be > 0")

        files = self._repository.list_split_files(dataset_identity, dataset_version, split)
        if not files:
            return

        rng = random.Random(seed) if shuffle else None
        if rng is not None:
            files = list(files)
            rng.shuffle(files)

        for file_path in files:
            suffix = file_path.suffix.lower()
            if suffix == ".csv":
                yield from self._iter_csv_batches(file_path, batch_size=batch_size, columns=columns, rng=rng)
                continue

            if suffix == ".parquet":
                yield from self._iter_parquet_batches(file_path, batch_size=batch_size, columns=columns, rng=rng)
                continue

            raise DataSetsValidationError(f"Unsupported tabular file extension: {file_path}")

    def count_rows(self, dataset_identity: str, dataset_version: str, split: str) -> int:
        total = 0
        for file_path in self._repository.list_split_files(dataset_identity, dataset_version, split):
            suffix = file_path.suffix.lower()
            if suffix == ".csv":
                with file_path.open("r", encoding="utf-8", newline="") as handle:
                    reader = csv.reader(handle)
                    next(reader, None)
                    total += sum(1 for _ in reader)
                continue

            if suffix == ".parquet":
                try:
                    pq = importlib.import_module("pyarrow.parquet")
                except Exception as exc:  # pragma: no cover
                    raise DataSetsRepositoryError(
                        "pyarrow is required to count parquet rows"
                    ) from exc

                parquet = pq.ParquetFile(file_path)
                total += parquet.metadata.num_rows
                continue

            raise DataSetsValidationError(f"Unsupported tabular file extension: {file_path}")

        return total

    def _iter_csv_batches(
        self,
        file_path: Path,
        batch_size: int,
        columns: Optional[Sequence[str]],
        rng: Optional[random.Random],
    ) -> Iterator[List[dict]]:
        with file_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            if columns is not None:
                missing = [column for column in columns if column not in (reader.fieldnames or [])]
                if missing:
                    raise DataSetsValidationError(
                        f"CSV file {file_path} missing required columns: {', '.join(missing)}"
                    )

            batch: List[dict] = []
            for row in reader:
                payload = row if columns is None else {key: row[key] for key in columns}
                batch.append(payload)
                if len(batch) == batch_size:
                    if rng is not None:
                        rng.shuffle(batch)
                    yield batch
                    batch = []

            if batch:
                if rng is not None:
                    rng.shuffle(batch)
                yield batch

    def _iter_parquet_batches(
        self,
        file_path: Path,
        batch_size: int,
        columns: Optional[Sequence[str]],
        rng: Optional[random.Random],
    ) -> Iterator[List[dict]]:
        try:
            pq = importlib.import_module("pyarrow.parquet")
        except Exception as exc:  # pragma: no cover
            raise DataSetsRepositoryError("pyarrow is required to load parquet batches") from exc

        parquet = pq.ParquetFile(file_path)
        for record_batch in parquet.iter_batches(batch_size=batch_size, columns=list(columns) if columns else None):
            payload = record_batch.to_pylist()
            if rng is not None:
                rng.shuffle(payload)
            yield payload
