from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import pandas as pd


@dataclass(frozen=True)
class TabularPreprocessingConfig:
    numeric_missing_strategy: str = "median"
    categorical_missing_value: str = "unknown"
    numeric_scaling: str = "standardization"
    categorical_encoding: str = "one_hot"
    max_categories_per_column: int = 25


@dataclass(frozen=True)
class TabularPreprocessingSummary:
    raw_numeric_feature_count: int
    raw_categorical_feature_count: int
    expanded_categorical_feature_count: int
    final_input_size: int
    numeric_columns: List[str]
    categorical_columns: List[str]


@dataclass
class TabularPreprocessingResult:
    transformed_train: pd.DataFrame
    transformed_val: pd.DataFrame
    feature_columns: List[str]
    summary: TabularPreprocessingSummary


class TabularPreprocessingService:
    """Preprocess tabular features for ANN training.

    Current MVP strategy:
    - Numeric: median imputation + standardization
    - Categorical: unknown imputation + one-hot encoding with rare category grouping

    Future extension point:
    - Add embedding-ready encoding branch for high-cardinality categorical columns.
    """

    def prepare(
        self,
        *,
        train_features: pd.DataFrame,
        val_features: pd.DataFrame,
        config: TabularPreprocessingConfig,
    ) -> TabularPreprocessingResult:
        train_df = train_features.copy()
        val_df = val_features.copy()

        for column in train_df.columns:
            if column not in val_df.columns:
                val_df[column] = None

        val_df = val_df[train_df.columns.tolist()]

        numeric_columns: List[str] = []
        categorical_columns: List[str] = []
        for column in train_df.columns:
            numeric_view = pd.to_numeric(train_df[column], errors="coerce")
            numeric_ratio = float(numeric_view.notna().mean()) if len(train_df[column]) > 0 else 0.0
            if numeric_ratio >= 0.9:
                numeric_columns.append(column)
            else:
                categorical_columns.append(column)

        prepared_train_numeric = pd.DataFrame(index=train_df.index)
        prepared_val_numeric = pd.DataFrame(index=val_df.index)

        for column in numeric_columns:
            train_numeric = pd.to_numeric(train_df[column], errors="coerce")
            val_numeric = pd.to_numeric(val_df[column], errors="coerce")

            median_value = float(train_numeric.median()) if train_numeric.notna().any() else 0.0
            train_imputed = train_numeric.fillna(median_value)
            val_imputed = val_numeric.fillna(median_value)

            if config.numeric_scaling == "standardization":
                mean_value = float(train_imputed.mean())
                std_value = float(train_imputed.std(ddof=0))
                if std_value <= 1e-12:
                    std_value = 1.0
                train_scaled = (train_imputed - mean_value) / std_value
                val_scaled = (val_imputed - mean_value) / std_value
            else:
                train_scaled = train_imputed
                val_scaled = val_imputed

            prepared_train_numeric[column] = train_scaled.astype(float)
            prepared_val_numeric[column] = val_scaled.astype(float)

        prepared_train_categorical = pd.DataFrame(index=train_df.index)
        prepared_val_categorical = pd.DataFrame(index=val_df.index)

        expanded_categorical_feature_count = 0
        for column in categorical_columns:
            train_series = train_df[column].astype("string").fillna(config.categorical_missing_value).str.strip()
            val_series = val_df[column].astype("string").fillna(config.categorical_missing_value).str.strip()

            top_categories = train_series.value_counts(dropna=False).head(config.max_categories_per_column).index.tolist()
            category_set = set(top_categories)

            train_bucketed = train_series.apply(lambda value: value if value in category_set else "other")
            val_bucketed = val_series.apply(lambda value: value if value in category_set else "other")

            if config.categorical_missing_value not in category_set:
                category_set.add(config.categorical_missing_value)
            category_set.add("other")

            ordered_categories = sorted(category_set)

            train_categorical = pd.Categorical(train_bucketed, categories=ordered_categories)
            val_categorical = pd.Categorical(val_bucketed, categories=ordered_categories)

            train_encoded = pd.get_dummies(train_categorical, prefix=column, dtype=float)
            val_encoded = pd.get_dummies(val_categorical, prefix=column, dtype=float)

            for encoded_column in train_encoded.columns:
                prepared_train_categorical[encoded_column] = train_encoded[encoded_column]
                prepared_val_categorical[encoded_column] = val_encoded.get(encoded_column, 0.0)

            expanded_categorical_feature_count += len(train_encoded.columns)

        transformed_train = pd.concat([prepared_train_numeric, prepared_train_categorical], axis=1)
        transformed_val = pd.concat([prepared_val_numeric, prepared_val_categorical], axis=1)

        transformed_train = transformed_train.astype(float)
        transformed_val = transformed_val.astype(float)

        feature_columns = transformed_train.columns.tolist()

        summary = TabularPreprocessingSummary(
            raw_numeric_feature_count=len(numeric_columns),
            raw_categorical_feature_count=len(categorical_columns),
            expanded_categorical_feature_count=expanded_categorical_feature_count,
            final_input_size=len(feature_columns),
            numeric_columns=numeric_columns,
            categorical_columns=categorical_columns,
        )

        return TabularPreprocessingResult(
            transformed_train=transformed_train,
            transformed_val=transformed_val,
            feature_columns=feature_columns,
            summary=summary,
        )
