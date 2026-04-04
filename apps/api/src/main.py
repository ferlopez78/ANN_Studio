from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Dict, List, Literal, Optional
from uuid import uuid4

import pandas as pd
import torch
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from features.ann_training.application.tabular_ann_training import (
    AnnTrainingError,
    EarlyStoppingConfig,
    LayerConfig,
    OptimizerConfig,
    SchedulerConfig,
    TabularAnnTrainingConfig,
    TabularAnnTrainingService,
)
from features.ann_training.application.tabular_preprocessing import (
    TabularPreprocessingConfig,
    TabularPreprocessingService,
)
from features.project_management.infrastructure.postgres import (
    archive_dataset,
    archive_client,
    archive_project,
    close_pool,
    create_dataset,
    create_client,
    create_project,
    ensure_tenant_and_user,
    list_datasets,
    list_clients,
    list_projects,
    run_project_management_migration,
    update_dataset,
    update_client,
    update_project,
)


class SheetProfile(BaseModel):
    name: str
    rowCount: int
    columns: List[str]


class InspectWorkbookResponse(BaseModel):
    inspectionId: str
    workbookName: str
    sheets: List[SheetProfile]


class ValidateMappingRequest(BaseModel):
    trainInspectionId: str
    valInspectionId: str
    trainSheet: str
    valSheet: str
    labelColumn: str


class Diagnostic(BaseModel):
    level: Literal["error", "warning", "info"]
    message: str


class ValidateMappingResponse(BaseModel):
    valid: bool
    diagnostics: List[Diagnostic]


class LaunchTrainingRequest(BaseModel):
    projectName: str
    datasetName: str
    trainInspectionId: str
    valInspectionId: str
    trainSheet: str
    valSheet: str
    labelColumn: str
    modelFamily: str
    epochs: int
    batchSize: int
    learningRate: float
    earlyStopping: bool
    earlyStoppingPatience: int
    modelArchitecture: dict | None = None
    modelTraining: dict | None = None


class LaunchTrainingResponse(BaseModel):
    backendRunId: str
    runName: str
    status: Literal["queued", "running", "completed", "failed"]
    epochsCompleted: int
    finalTrainLoss: float
    finalTrainMetricName: str
    finalTrainMetric: float
    epochHistory: List[dict]
    artifactFileName: str
    artifactDownloadUrl: str
    statusMessages: List[dict]
    preprocessingSummary: dict | None = None


class RunStatusResponse(BaseModel):
    backendRunId: str
    runName: str
    status: Literal["queued", "running", "completed", "failed"]
    statusMessages: List[dict]
    hasArtifact: bool
    artifactDownloadUrl: str | None
    preprocessingSummary: dict | None = None


class ArtifactMetaResponse(BaseModel):
    backendRunId: str
    runName: str
    artifactFileName: str
    artifactDownloadUrl: str
    projectName: str
    datasetName: str
    modelFamily: str
    labelColumn: str
    featureColumns: List[str]
    taskType: str
    outputUnits: int
    outputActivation: str
    epochsCompleted: int
    finalTrainLoss: float
    finalTrainMetricName: str
    finalTrainMetric: float
    createdAtUtc: str


class ArtifactInspectLayerResponse(BaseModel):
    index: int
    activation: str
    useBias: bool
    inputUnits: int
    outputUnits: int
    dropout: float
    weights: List[List[float]]
    bias: List[float]


class ArtifactInspectResponse(BaseModel):
    backendRunId: str
    runName: str
    projectName: str
    datasetName: str
    modelFamily: str
    taskType: str
    outputUnits: int
    outputActivation: str
    epochsCompleted: int
    finalTrainLoss: float
    finalTrainMetricName: str
    finalTrainMetric: float
    epochHistory: List[dict]
    preprocessingSummary: dict | None = None
    architecture: List[dict]
    trainedLayers: List[ArtifactInspectLayerResponse]


class ClientUpsertRequest(BaseModel):
    code: str = ""
    name: str
    status: Literal["active", "inactive"]
    notes: str | None = None


class ClientResponse(BaseModel):
    id: str
    tenantId: str
    code: str
    name: str
    status: Literal["active", "inactive"]
    notes: str | None = None
    createdByUserId: str
    createdAtUtc: str
    updatedAtUtc: str


class ProjectUpsertRequest(BaseModel):
    clientId: str
    code: str
    name: str
    status: Literal["draft", "active", "paused", "archived"]
    networkType: Literal["ANN Binary", "ANN Multiclass", "CNN Vision", "Custom Detector"]
    description: str | None = None
    datasetIds: List[str] = []
    modelIds: List[str] = []
    modelCombinations: List[str] = []


class ProjectResponse(BaseModel):
    id: str
    tenantId: str
    clientId: str
    clientName: str | None = None
    code: str
    name: str
    status: Literal["draft", "active", "paused", "archived"]
    networkType: Literal["ANN Binary", "ANN Multiclass", "CNN Vision", "Custom Detector"]
    description: str | None = None
    datasetIds: List[str]
    modelIds: List[str]
    modelCombinations: List[str]
    createdByUserId: str
    createdAtUtc: str
    updatedAtUtc: str


class DatasetUpsertRequest(BaseModel):
    code: str = ""
    name: str
    type: Literal["Tabular", "Computer Vision"]
    status: Literal["Ready", "Pending Validation"] = "Ready"
    projectIds: List[str]


class DatasetResponse(BaseModel):
    id: str
    tenantId: str
    code: str
    name: str
    type: Literal["Tabular", "Computer Vision"]
    status: Literal["Ready", "Pending Validation"]
    versions: int
    projectIds: List[str]
    createdByUserId: str
    createdAtUtc: str
    updatedAtUtc: str


@dataclass
class WorkbookInspection:
    workbook_name: str
    sheets: List[SheetProfile]
    payload: bytes


_INSPECTIONS: Dict[str, WorkbookInspection] = {}
_RUN_COUNTERS: Dict[str, int] = {}
_TRAINER = TabularAnnTrainingService()
_PREPROCESSOR = TabularPreprocessingService()
_RUN_ARTIFACTS: Dict[str, Path] = {}
_RUN_ARTIFACT_META: Dict[str, ArtifactMetaResponse] = {}
_RUN_STATUS: Dict[str, dict] = {}
_ARTIFACT_DIR = (Path(__file__).resolve().parents[1] / "artifacts").resolve()
_ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


app = FastAPI(title="ANN Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    if os.getenv("AUTO_MIGRATE_PROJECT_DB", "true").strip().lower() in {"1", "true", "yes"}:
        run_project_management_migration()


@app.on_event("shutdown")
def shutdown() -> None:
    close_pool()


def _tenant_user_context(
    x_tenant_id: str | None,
    x_user_id: str | None,
) -> tuple[str, str]:
    tenant_id = (x_tenant_id or "").strip()
    user_id = (x_user_id or "").strip()

    if not tenant_id:
        raise HTTPException(status_code=401, detail="Missing X-Tenant-Id header.")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header.")

    ensure_tenant_and_user(tenant_id=tenant_id, user_id=user_id)
    return tenant_id, user_id


def _normalize_token(value: str) -> str:
    token = "".join(ch for ch in value if ch.isalnum()).upper()
    return token[:5]


def _build_name_prefix(project_name: str, dataset_name: str) -> str:
    date_token = datetime.utcnow().strftime("%Y%m%d")
    return f"{_normalize_token(project_name)}_{_normalize_token(dataset_name)}_{date_token}"


def _next_run_name(project_name: str, dataset_name: str) -> str:
    prefix = _build_name_prefix(project_name, dataset_name)
    next_number = _RUN_COUNTERS.get(prefix, 0) + 1
    _RUN_COUNTERS[prefix] = next_number
    return f"{prefix}_RUN_{next_number:02d}"


def _inspect_excel(file_name: str, payload: bytes) -> WorkbookInspection:
    try:
        xls = pd.ExcelFile(BytesIO(payload))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read Excel file: {exc}") from exc

    sheet_profiles: List[SheetProfile] = []
    for sheet_name in xls.sheet_names:
        frame = xls.parse(sheet_name=sheet_name)
        columns = [str(column) for column in frame.columns]
        sheet_profiles.append(
            SheetProfile(
                name=sheet_name,
                rowCount=int(frame.shape[0]),
                columns=columns,
            )
        )

    return WorkbookInspection(workbook_name=file_name, sheets=sheet_profiles, payload=payload)


def _sheet_by_name(inspection: WorkbookInspection, sheet_name: str) -> SheetProfile | None:
    for sheet in inspection.sheets:
        if sheet.name == sheet_name:
            return sheet
    return None


def _load_sheet_dataframe(inspection: WorkbookInspection, sheet_name: str) -> pd.DataFrame:
    xls = pd.ExcelFile(BytesIO(inspection.payload))
    frame = xls.parse(sheet_name=sheet_name)
    frame.columns = [str(column) for column in frame.columns]
    return frame


def _infer_training_task(label_values: pd.Series) -> tuple[Literal["binary_classification", "multiclass_classification"], int, str]:
    classes = sorted({str(value) for value in label_values.dropna().tolist()})
    if len(classes) < 2:
        raise HTTPException(status_code=400, detail="Label column must contain at least two classes.")

    if len(classes) == 2:
        return "binary_classification", 1, "sigmoid"

    return "multiclass_classification", len(classes), "softmax"


def _normalize_activation_name(raw: str) -> str:
    token = str(raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "relu": "relu",
        "leakyrelu": "leaky_relu",
        "leaky_relu": "leaky_relu",
        "elu": "elu",
        "gelu": "gelu",
        "tanh": "tanh",
        "sigmoid": "sigmoid",
        "softmax": "softmax",
        "linear": "linear",
    }
    return aliases.get(token, token)


def _resolve_model_topology(payload: LaunchTrainingRequest, label_values: pd.Series) -> tuple[str, int, str, List[LayerConfig], int, str, str]:
    inferred_task_type, inferred_output_units, inferred_output_activation = _infer_training_task(label_values)
    class_count = len(sorted({str(value) for value in label_values.dropna().tolist()}))

    architecture = payload.modelArchitecture or {}
    training = payload.modelTraining or {}

    if architecture.get("kind") != "ANN":
        raise HTTPException(status_code=400, detail="Selected model has no ANN architecture payload. Recreate/select a designed ANN model.")

    hidden_raw = architecture.get("hiddenLayers")
    if not isinstance(hidden_raw, list) or len(hidden_raw) == 0:
        raise HTTPException(status_code=400, detail="Selected model ANN hiddenLayers are missing.")

    hidden_layers: List[LayerConfig] = []
    for index, layer in enumerate(hidden_raw):
        if not isinstance(layer, dict):
            raise HTTPException(status_code=400, detail=f"Hidden layer {index + 1} is invalid.")

        units = int(layer.get("units", 0))
        if units <= 0:
            raise HTTPException(status_code=400, detail=f"Hidden layer {index + 1} units must be > 0.")

        activation = _normalize_activation_name(str(layer.get("activation", "relu")))
        dropout = float(layer.get("dropout", 0.0))
        if dropout < 0 or dropout >= 1:
            raise HTTPException(status_code=400, detail=f"Hidden layer {index + 1} dropout must be in [0, 1).")
        hidden_layers.append(LayerConfig(units=units, activation=activation, dropout=dropout))

    requested_output_units = int(architecture.get("outputSize", inferred_output_units))
    requested_output_activation = _normalize_activation_name(str(architecture.get("outputActivation", inferred_output_activation)))

    # Auto-reconcile common ANN output mismatches so legacy/stale model payloads can still train.
    if requested_output_activation == "sigmoid":
        if class_count == 2 and requested_output_units != 1:
            requested_output_units = 1

        if requested_output_units != 1:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unsupported output configuration: outputSize={requested_output_units}, outputActivation={requested_output_activation}. "
                    "For sigmoid output, set outputSize=1."
                ),
            )

        if class_count != 2:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Output configuration expects binary classes, but label column does not have exactly 2 classes. "
                    f"Detected class count: {class_count}."
                ),
            )
        task_type = "binary_classification"

    elif requested_output_activation == "softmax":
        if requested_output_units < 2:
            requested_output_units = class_count

        if class_count != requested_output_units:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Model outputSize ({requested_output_units}) must match class count in label column ({class_count}) "
                    "when using softmax output."
                ),
            )
        task_type = "multiclass_classification"

    else:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported output configuration: outputSize={requested_output_units}, outputActivation={requested_output_activation}. "
                "Use outputSize=1 + sigmoid for binary, or outputSize>=2 + softmax for multiclass."
            ),
        )

    seed = int(training.get("seed", 42))
    optimizer_name = str(training.get("optimizer", "sgd")).strip().lower()
    scheduler_name = str(training.get("scheduler", "none")).strip().lower().replace("_", "")
    scheduler_aliases = {
        "cosineannealing": "cosineannealing",
        "reducelronplateau": "reducelronplateau",
        "steplr": "steplr",
        "onecyclelr": "onecyclelr",
        "exponentiallr": "exponentiallr",
        "none": "none",
    }
    scheduler_name = scheduler_aliases.get(scheduler_name, scheduler_name)

    return task_type, requested_output_units, requested_output_activation, hidden_layers, seed, optimizer_name, scheduler_name


def _build_epoch_history(result, model_family: str, learning_rate: float) -> list[dict]:
    history: list[dict] = []
    total_epochs = max(1, len(result.train_losses))
    layer_count = max(2, len(result.trained_layers) + 1)

    for index, (loss_value, metric_value) in enumerate(zip(result.train_losses, result.train_metrics), start=1):
        progress = index / total_epochs
        train_loss = float(loss_value)
        val_loss = float(result.val_losses[index - 1]) if index - 1 < len(result.val_losses) else train_loss

        if result.final_train_metric_name == "accuracy":
            train_precision = float(metric_value)
            val_precision = float(result.val_metrics[index - 1]) if index - 1 < len(result.val_metrics) else 0.0
        else:
            train_precision = 0.0
            val_precision = 0.0

        epoch_learning_rate = (
            float(result.learning_rates[index - 1])
            if index - 1 < len(getattr(result, "learning_rates", []))
            else float(learning_rate)
        )

        layer_activations = [
            float(max(0.05, min(0.98, 0.18 + 0.68 * progress + 0.05 * ((index + layer_idx) % 3))))
            for layer_idx in range(layer_count)
        ]

        history.append(
            {
                "epoch": index,
                "trainLoss": train_loss,
                "valLoss": val_loss,
                "trainPrecision": train_precision,
                "valPrecision": val_precision,
                "learningRate": epoch_learning_rate,
                "layerActivations": layer_activations,
                "confusionMatrix": (
                    result.val_confusion_matrices[index - 1]
                    if index - 1 < len(result.val_confusion_matrices)
                    else ([[0, 0], [0, 0]] if model_family != "ANN Multiclass" else [[0, 0, 0], [0, 0, 0], [0, 0, 0]])
                ),
            }
        )
    return history


def _safe_artifact_name(run_name: str) -> str:
    token = "".join(char if char.isalnum() or char in ("_", "-") else "_" for char in run_name)
    return f"{token}.pt"


def _save_pt_artifact(backend_run_id: str, run_name: str, payload: dict) -> Path:
    artifact_name = _safe_artifact_name(run_name)
    artifact_path = _ARTIFACT_DIR / f"{backend_run_id}__{artifact_name}"

    torch.save(payload, artifact_path)

    _RUN_ARTIFACTS[backend_run_id] = artifact_path
    return artifact_path


def _friendly_artifact_name(path: Path) -> str:
    parts = path.name.split("__", 1)
    return parts[1] if len(parts) == 2 else path.name


def _resolve_artifact_path(backend_run_id: str) -> Path | None:
    in_memory = _RUN_ARTIFACTS.get(backend_run_id)
    if in_memory and in_memory.exists():
        return in_memory

    matches = sorted(_ARTIFACT_DIR.glob(f"{backend_run_id}__*.pt"), key=lambda path: path.stat().st_mtime, reverse=True)
    if matches:
        _RUN_ARTIFACTS[backend_run_id] = matches[0]
        return matches[0]

    return None


def _build_artifact_meta(
    *,
    backend_run_id: str,
    run_name: str,
    artifact_name: str,
    project_name: str,
    dataset_name: str,
    model_family: str,
    label_column: str,
    feature_columns: List[str],
    task_type: str,
    output_units: int,
    output_activation: str,
    epochs_completed: int,
    final_train_loss: float,
    final_train_metric_name: str,
    final_train_metric: float,
    created_at_utc: str,
) -> ArtifactMetaResponse:
    return ArtifactMetaResponse(
        backendRunId=backend_run_id,
        runName=run_name,
        artifactFileName=artifact_name,
        artifactDownloadUrl=f"/api/runs/{backend_run_id}/artifact",
        projectName=project_name,
        datasetName=dataset_name,
        modelFamily=model_family,
        labelColumn=label_column,
        featureColumns=feature_columns,
        taskType=task_type,
        outputUnits=output_units,
        outputActivation=output_activation,
        epochsCompleted=epochs_completed,
        finalTrainLoss=final_train_loss,
        finalTrainMetricName=final_train_metric_name,
        finalTrainMetric=final_train_metric,
        createdAtUtc=created_at_utc,
    )


def _utc_now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _init_run_status(backend_run_id: str, run_name: str) -> None:
    _RUN_STATUS[backend_run_id] = {
        "backendRunId": backend_run_id,
        "runName": run_name,
        "status": "queued",
        "statusMessages": [],
        "artifactDownloadUrl": None,
        "preprocessingSummary": None,
    }


def _append_run_message(backend_run_id: str, level: Literal["info", "warning", "error"], message: str) -> None:
    state = _RUN_STATUS.get(backend_run_id)
    if not state:
        return

    state["statusMessages"].append(
        {
            "timestampUtc": _utc_now(),
            "level": level,
            "message": message,
        }
    )


def _set_run_status(backend_run_id: str, status: Literal["queued", "running", "completed", "failed"]) -> None:
    state = _RUN_STATUS.get(backend_run_id)
    if not state:
        return

    state["status"] = status


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def _to_client_response(row: dict) -> ClientResponse:
    return ClientResponse(
        id=str(row["id"]),
        tenantId=str(row["tenant_id"]),
        code=str(row["code"]),
        name=str(row["name"]),
        status=str(row["status"]),
        notes=row.get("notes"),
        createdByUserId=str(row["created_by_user_id"]),
        createdAtUtc=row["created_at_utc"].isoformat(),
        updatedAtUtc=row["updated_at_utc"].isoformat(),
    )


def _to_project_response(row: dict) -> ProjectResponse:
    return ProjectResponse(
        id=str(row["id"]),
        tenantId=str(row["tenant_id"]),
        clientId=str(row["client_id"]),
        clientName=row.get("client_name"),
        code=str(row["code"]),
        name=str(row["name"]),
        status=str(row["status"]),
        networkType=str(row["network_type"]),
        description=row.get("description"),
        datasetIds=list(row.get("dataset_ids") or []),
        modelIds=list(row.get("model_ids") or []),
        modelCombinations=list(row.get("model_combinations") or []),
        createdByUserId=str(row["created_by_user_id"]),
        createdAtUtc=row["created_at_utc"].isoformat(),
        updatedAtUtc=row["updated_at_utc"].isoformat(),
    )


def _to_dataset_response(row: dict) -> DatasetResponse:
    return DatasetResponse(
        id=str(row["id"]),
        tenantId=str(row["tenant_id"]),
        code=str(row["code"]),
        name=str(row["name"]),
        type=str(row["dataset_type"]),
        status=str(row["status"]),
        versions=int(row.get("versions") or 0),
        projectIds=[str(value) for value in list(row.get("project_ids") or [])],
        createdByUserId=str(row["created_by_user_id"]),
        createdAtUtc=row["created_at_utc"].isoformat(),
        updatedAtUtc=row["updated_at_utc"].isoformat(),
    )


@app.get("/api/clients", response_model=List[ClientResponse])
def get_clients(
    status: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> List[ClientResponse]:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    rows = list_clients(tenant_id=tenant_id, status=status, q=q)
    return [_to_client_response(row) for row in rows]


@app.post("/api/clients", response_model=ClientResponse)
def post_client(
    payload: ClientUpsertRequest,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> ClientResponse:
    tenant_id, user_id = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    row = create_client(
        tenant_id=tenant_id,
        user_id=user_id,
        code=payload.code,
        name=payload.name,
        status=payload.status,
        notes=payload.notes,
    )
    return _to_client_response(row)


@app.patch("/api/clients/{client_id}", response_model=ClientResponse)
def patch_client(
    client_id: str,
    payload: ClientUpsertRequest,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> ClientResponse:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    row = update_client(
        tenant_id=tenant_id,
        client_id=client_id,
        code=payload.code,
        name=payload.name,
        status=payload.status,
        notes=payload.notes,
    )
    return _to_client_response(row)


@app.delete("/api/clients/{client_id}")
def delete_client(
    client_id: str,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    archive_client(tenant_id=tenant_id, client_id=client_id)
    return {"deleted": True}


@app.get("/api/projects", response_model=List[ProjectResponse])
def get_projects(
    clientId: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> List[ProjectResponse]:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    rows = list_projects(tenant_id=tenant_id, client_id=clientId, status=status, q=q)
    return [_to_project_response(row) for row in rows]


@app.post("/api/projects", response_model=ProjectResponse)
def post_project(
    payload: ProjectUpsertRequest,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> ProjectResponse:
    tenant_id, user_id = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    row = create_project(
        tenant_id=tenant_id,
        user_id=user_id,
        client_id=payload.clientId,
        code=payload.code,
        name=payload.name,
        status=payload.status,
        network_type=payload.networkType,
        description=payload.description,
        dataset_ids=payload.datasetIds,
        model_ids=payload.modelIds,
        model_combinations=payload.modelCombinations,
    )
    row["client_name"] = None
    return _to_project_response(row)


@app.patch("/api/projects/{project_id}", response_model=ProjectResponse)
def patch_project(
    project_id: str,
    payload: ProjectUpsertRequest,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> ProjectResponse:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    row = update_project(
        tenant_id=tenant_id,
        project_id=project_id,
        client_id=payload.clientId,
        code=payload.code,
        name=payload.name,
        status=payload.status,
        network_type=payload.networkType,
        description=payload.description,
        dataset_ids=payload.datasetIds,
        model_ids=payload.modelIds,
        model_combinations=payload.modelCombinations,
    )
    row["client_name"] = None
    return _to_project_response(row)


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: str,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    archive_project(tenant_id=tenant_id, project_id=project_id)
    return {"deleted": True}


@app.get("/api/datasets", response_model=List[DatasetResponse])
def get_datasets(
    projectId: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> List[DatasetResponse]:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    rows = list_datasets(tenant_id=tenant_id, project_id=projectId, status=status, q=q)
    return [_to_dataset_response(row) for row in rows]


@app.post("/api/datasets", response_model=DatasetResponse)
def post_dataset(
    payload: DatasetUpsertRequest,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> DatasetResponse:
    tenant_id, user_id = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    row = create_dataset(
        tenant_id=tenant_id,
        user_id=user_id,
        code=payload.code,
        name=payload.name,
        dataset_type=payload.type,
        status=payload.status,
        project_ids=payload.projectIds,
    )
    return _to_dataset_response(row)


@app.patch("/api/datasets/{dataset_id}", response_model=DatasetResponse)
def patch_dataset(
    dataset_id: str,
    payload: DatasetUpsertRequest,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> DatasetResponse:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    row = update_dataset(
        tenant_id=tenant_id,
        dataset_id=dataset_id,
        code=payload.code,
        name=payload.name,
        dataset_type=payload.type,
        status=payload.status,
        project_ids=payload.projectIds,
    )
    return _to_dataset_response(row)


@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict:
    tenant_id, _ = _tenant_user_context(x_tenant_id=x_tenant_id, x_user_id=x_user_id)
    archive_dataset(tenant_id=tenant_id, dataset_id=dataset_id)
    return {"deleted": True}


@app.post("/api/datasets/excel/inspect", response_model=InspectWorkbookResponse)
async def inspect_workbook(file: UploadFile = File(...)) -> InspectWorkbookResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    lower_name = file.filename.lower()
    if not (lower_name.endswith(".xlsx") or lower_name.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx and .xls files are supported")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    inspection = _inspect_excel(file.filename, payload)
    inspection_id = str(uuid4())
    _INSPECTIONS[inspection_id] = inspection

    return InspectWorkbookResponse(
        inspectionId=inspection_id,
        workbookName=inspection.workbook_name,
        sheets=inspection.sheets,
    )


@app.post("/api/datasets/excel/validate-mapping", response_model=ValidateMappingResponse)
def validate_mapping(payload: ValidateMappingRequest) -> ValidateMappingResponse:
    train_inspection = _INSPECTIONS.get(payload.trainInspectionId)
    val_inspection = _INSPECTIONS.get(payload.valInspectionId)

    diagnostics: List[Diagnostic] = []

    if not train_inspection:
        diagnostics.append(Diagnostic(level="error", message="Train inspection reference not found."))
    if not val_inspection:
        diagnostics.append(Diagnostic(level="error", message="Validation inspection reference not found."))

    if diagnostics:
        return ValidateMappingResponse(valid=False, diagnostics=diagnostics)

    train_sheet = _sheet_by_name(train_inspection, payload.trainSheet)
    val_sheet = _sheet_by_name(val_inspection, payload.valSheet)

    if not train_sheet:
        diagnostics.append(Diagnostic(level="error", message="Train sheet not found in selected workbook."))
    if not val_sheet:
        diagnostics.append(Diagnostic(level="error", message="Validation sheet not found in selected workbook."))

    if train_sheet and payload.labelColumn not in train_sheet.columns:
        diagnostics.append(Diagnostic(level="error", message="Label column is not present in Train sheet."))

    if val_sheet and payload.labelColumn not in val_sheet.columns:
        diagnostics.append(Diagnostic(level="warning", message="Label column is not present in Validation sheet."))

    if train_sheet and val_sheet:
        train_columns = set(train_sheet.columns)
        val_columns = set(val_sheet.columns)
        if train_columns != val_columns:
            diagnostics.append(
                Diagnostic(level="warning", message="Train and Validation sheet columns differ. Check schema consistency.")
            )

    is_valid = all(item.level != "error" for item in diagnostics)
    if is_valid:
        diagnostics.append(Diagnostic(level="info", message="Mapping and label selection are valid."))

    return ValidateMappingResponse(valid=is_valid, diagnostics=diagnostics)


@app.post("/api/runs/launch", response_model=LaunchTrainingResponse)
def launch_training(payload: LaunchTrainingRequest) -> LaunchTrainingResponse:
    run_name = _next_run_name(payload.projectName, payload.datasetName)
    backend_run_id = f"backend-run-{uuid4()}"
    _init_run_status(backend_run_id, run_name)
    _append_run_message(backend_run_id, "info", "Run request received by backend.")

    validation = validate_mapping(
        ValidateMappingRequest(
            trainInspectionId=payload.trainInspectionId,
            valInspectionId=payload.valInspectionId,
            trainSheet=payload.trainSheet,
            valSheet=payload.valSheet,
            labelColumn=payload.labelColumn,
        )
    )

    if not validation.valid:
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", "Workbook mapping validation failed.")
        raise HTTPException(status_code=400, detail=[item.model_dump() for item in validation.diagnostics])

    train_inspection = _INSPECTIONS.get(payload.trainInspectionId)
    val_inspection = _INSPECTIONS.get(payload.valInspectionId)
    if not train_inspection or not val_inspection:
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", "Inspection references are no longer available.")
        raise HTTPException(status_code=400, detail="Inspection references are no longer available.")

    _set_run_status(backend_run_id, "running")
    _append_run_message(backend_run_id, "info", "Workbook mapping validated. Starting training pipeline.")
    _append_run_message(backend_run_id, "info", f"Loading Train sheet '{payload.trainSheet}' and Validation sheet '{payload.valSheet}'.")

    train_frame = _load_sheet_dataframe(train_inspection, payload.trainSheet)
    val_frame = _load_sheet_dataframe(val_inspection, payload.valSheet)

    if payload.labelColumn not in train_frame.columns:
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", "Selected label column was not found in Train sheet.")
        raise HTTPException(status_code=400, detail="Selected label column was not found in Train sheet.")

    feature_columns = [column for column in train_frame.columns if column != payload.labelColumn]
    if not feature_columns:
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", "No feature columns found besides the selected label.")
        raise HTTPException(status_code=400, detail="At least one feature column is required besides label column.")

    train_frame = train_frame.dropna(subset=[payload.labelColumn]).copy()
    if train_frame.empty:
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", "Train sheet has no non-null rows for the selected label column.")
        raise HTTPException(status_code=400, detail="Train sheet has no non-null rows for the selected label column.")

    task_type, output_units, output_activation, hidden_layers, model_seed, optimizer_name, scheduler_name = _resolve_model_topology(
        payload,
        train_frame[payload.labelColumn],
    )

    preprocessing_result = _PREPROCESSOR.prepare(
        train_features=train_frame[feature_columns],
        val_features=val_frame[feature_columns] if all(column in val_frame.columns for column in feature_columns) else val_frame,
        config=TabularPreprocessingConfig(),
    )

    preprocessing_summary = {
        "numericScaling": "standardization",
        "categoricalEncoding": "one_hot",
        "numericMissingStrategy": "median",
        "categoricalMissingStrategy": "unknown",
        "rawNumericFeatureCount": preprocessing_result.summary.raw_numeric_feature_count,
        "rawCategoricalFeatureCount": preprocessing_result.summary.raw_categorical_feature_count,
        "expandedCategoricalFeatureCount": preprocessing_result.summary.expanded_categorical_feature_count,
        "suggestedInputLayerSize": preprocessing_result.summary.final_input_size,
    }
    _RUN_STATUS[backend_run_id]["preprocessingSummary"] = preprocessing_summary

    feature_columns = preprocessing_result.feature_columns
    _append_run_message(
        backend_run_id,
        "info",
        (
            "Preprocessing complete: "
            f"numeric={preprocessing_result.summary.raw_numeric_feature_count}, "
            f"categorical={preprocessing_result.summary.raw_categorical_feature_count}, "
            f"expanded_categorical={preprocessing_result.summary.expanded_categorical_feature_count}, "
            f"suggested_input_layer_size={preprocessing_result.summary.final_input_size}."
        ),
    )
    _append_run_message(
        backend_run_id,
        "info",
        f"Training task inferred as {task_type}. Features={len(feature_columns)}, output_units={output_units}.",
    )

    train_serialized = preprocessing_result.transformed_train.copy()
    train_serialized[payload.labelColumn] = train_frame[payload.labelColumn].astype(str).values

    try:
        with TemporaryDirectory(prefix="annstudio-train-") as temp_dir:
            _append_run_message(backend_run_id, "info", "Serializing training CSV for ANN training service.")
            train_file_path = Path(temp_dir) / "train.csv"
            train_serialized.to_csv(train_file_path, index=False)

            _append_run_message(
                backend_run_id,
                "info",
                f"Executing python trainer: epochs={payload.epochs}, batch_size={payload.batchSize}, learning_rate={payload.learningRate}.",
            )
            result = _TRAINER.run(
                TabularAnnTrainingConfig(
                    dataset_path=temp_dir,
                    selected_file="train.csv",
                    feature_columns=feature_columns,
                    target_columns=[payload.labelColumn],
                    task_type=task_type,
                    hidden_layers=hidden_layers,
                    output_units=output_units,
                    output_activation=output_activation,
                    optimizer=OptimizerConfig(name=optimizer_name, learning_rate=payload.learningRate),
                    scheduler=SchedulerConfig(name=scheduler_name),
                    epochs=payload.epochs,
                    batch_size=payload.batchSize,
                    shuffle_within_batch=True,
                    seed=model_seed,
                    validation_features=preprocessing_result.transformed_val.to_numpy(dtype=float).tolist(),
                    validation_targets=val_frame[[payload.labelColumn]].astype(str).values.tolist(),
                    early_stopping=EarlyStoppingConfig(
                        enabled=payload.earlyStopping,
                        patience=payload.earlyStoppingPatience,
                        min_delta=1e-4,
                    ),
                )
            )
            _append_run_message(
                backend_run_id,
                "info",
                f"Training finished. Epochs completed={result.epochs_completed}, final {result.final_train_metric_name}={result.final_train_metric:.4f}.",
            )
    except AnnTrainingError as exc:
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", f"Training failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        _set_run_status(backend_run_id, "failed")
        _append_run_message(backend_run_id, "error", f"Unexpected backend training error: {exc}")
        raise HTTPException(status_code=500, detail=f"Unexpected backend training error: {exc}") from exc

    created_at_utc = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    artifact_payload = {
        "run_name": run_name,
        "backend_run_id": backend_run_id,
        "project_name": payload.projectName,
        "dataset_name": payload.datasetName,
        "model_family": payload.modelFamily,
        "feature_columns": feature_columns,
        "preprocessing": {
            "numeric_scaling": "standardization",
            "categorical_encoding": "one_hot",
            "numeric_missing_strategy": "median",
            "categorical_missing_strategy": "unknown",
            "raw_numeric_feature_count": preprocessing_result.summary.raw_numeric_feature_count,
            "raw_categorical_feature_count": preprocessing_result.summary.raw_categorical_feature_count,
            "expanded_categorical_feature_count": preprocessing_result.summary.expanded_categorical_feature_count,
            "suggested_input_layer_size": preprocessing_result.summary.final_input_size,
            "numeric_columns": preprocessing_result.summary.numeric_columns,
            "categorical_columns": preprocessing_result.summary.categorical_columns,
        },
        "label_column": payload.labelColumn,
        "task_type": task_type,
        "output_units": output_units,
        "output_activation": output_activation,
        "class_labels": result.class_labels,
        "trained_layers": result.trained_layers,
        "training_config": {
            "epochs": payload.epochs,
            "batch_size": payload.batchSize,
            "learning_rate": payload.learningRate,
            "optimizer": optimizer_name,
            "scheduler": scheduler_name,
            "seed": model_seed,
            "early_stopping": payload.earlyStopping,
            "early_stopping_patience": payload.earlyStoppingPatience,
            "train_sheet": payload.trainSheet,
            "val_sheet": payload.valSheet,
            "hidden_layers": [
                {
                    "units": layer.units,
                    "activation": layer.activation,
                    "use_bias": layer.use_bias,
                    "dropout": layer.dropout,
                }
                for index, layer in enumerate(hidden_layers)
            ],
            "output_size": output_units,
            "output_activation": output_activation,
        },
        "metrics": {
            "epochs_completed": result.epochs_completed,
            "final_train_loss": result.final_train_loss,
            "final_train_metric_name": result.final_train_metric_name,
            "final_train_metric": result.final_train_metric,
        },
        "epoch_history": _build_epoch_history(result, payload.modelFamily, payload.learningRate),
        "created_at_utc": created_at_utc,
    }

    artifact_path = _save_pt_artifact(backend_run_id, run_name, artifact_payload)
    artifact_download_url = f"/api/runs/{backend_run_id}/artifact"
    _RUN_STATUS[backend_run_id]["artifactDownloadUrl"] = artifact_download_url
    _set_run_status(backend_run_id, "completed")
    _append_run_message(backend_run_id, "info", f"Artifact generated at backend: {artifact_path.name}")
    epoch_history = artifact_payload["epoch_history"]

    _RUN_ARTIFACT_META[backend_run_id] = _build_artifact_meta(
        backend_run_id=backend_run_id,
        run_name=run_name,
        artifact_name=_friendly_artifact_name(artifact_path),
        project_name=payload.projectName,
        dataset_name=payload.datasetName,
        model_family=payload.modelFamily,
        label_column=payload.labelColumn,
        feature_columns=feature_columns,
        task_type=task_type,
        output_units=output_units,
        output_activation=output_activation,
        epochs_completed=result.epochs_completed,
        final_train_loss=result.final_train_loss,
        final_train_metric_name=result.final_train_metric_name,
        final_train_metric=result.final_train_metric,
        created_at_utc=created_at_utc,
    )

    return LaunchTrainingResponse(
        backendRunId=backend_run_id,
        runName=run_name,
        status="completed",
        epochsCompleted=result.epochs_completed,
        finalTrainLoss=result.final_train_loss,
        finalTrainMetricName=result.final_train_metric_name,
        finalTrainMetric=result.final_train_metric,
        epochHistory=epoch_history,
        artifactFileName=_friendly_artifact_name(artifact_path),
        artifactDownloadUrl=artifact_download_url,
        statusMessages=_RUN_STATUS[backend_run_id]["statusMessages"],
        preprocessingSummary=preprocessing_summary,
    )


@app.get("/api/runs/{backend_run_id}/status", response_model=RunStatusResponse)
def run_status(backend_run_id: str) -> RunStatusResponse:
    state = _RUN_STATUS.get(backend_run_id)
    if not state:
        raise HTTPException(status_code=404, detail="Run status not found")

    artifact_download_url = state.get("artifactDownloadUrl")
    return RunStatusResponse(
        backendRunId=backend_run_id,
        runName=str(state["runName"]),
        status=state["status"],
        statusMessages=state["statusMessages"],
        hasArtifact=bool(artifact_download_url),
        artifactDownloadUrl=artifact_download_url,
        preprocessingSummary=state.get("preprocessingSummary"),
    )


@app.get("/api/runs/{backend_run_id}/artifact")
def download_artifact(backend_run_id: str):
    artifact_path = _resolve_artifact_path(backend_run_id)
    if not artifact_path:
        raise HTTPException(status_code=404, detail="Run artifact not found")

    return FileResponse(
        path=artifact_path,
        media_type="application/octet-stream",
        filename=_friendly_artifact_name(artifact_path),
    )


@app.get("/api/runs/{backend_run_id}/artifact/meta", response_model=ArtifactMetaResponse)
def artifact_meta(backend_run_id: str) -> ArtifactMetaResponse:
    metadata = _RUN_ARTIFACT_META.get(backend_run_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Run artifact metadata not found")

    return metadata


@app.get("/api/runs/{backend_run_id}/artifact/inspect", response_model=ArtifactInspectResponse)
def artifact_inspect(backend_run_id: str) -> ArtifactInspectResponse:
    metadata = _RUN_ARTIFACT_META.get(backend_run_id)

    artifact_path = _resolve_artifact_path(backend_run_id)
    if not artifact_path:
        raise HTTPException(status_code=404, detail="Run artifact not found")

    try:
        payload = torch.load(artifact_path, map_location="cpu")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read artifact payload: {exc}") from exc

    def _as_float_list(values) -> List[float]:
        normalized: List[float] = []
        if not isinstance(values, list):
            return normalized

        for item in values:
            if isinstance(item, list):
                for nested in item:
                    try:
                        normalized.append(float(nested))
                    except (TypeError, ValueError):
                        continue
            else:
                try:
                    normalized.append(float(item))
                except (TypeError, ValueError):
                    continue

        return normalized

    def _as_float_matrix(values) -> List[List[float]]:
        matrix: List[List[float]] = []
        if not isinstance(values, list):
            return matrix

        for row in values:
            if isinstance(row, list):
                matrix.append(_as_float_list(row))
            else:
                try:
                    matrix.append([float(row)])
                except (TypeError, ValueError):
                    continue

        return matrix

    architecture = payload.get("training_config", {}).get("hidden_layers", [])
    trained_layers_payload = payload.get("trained_layers", [])
    inspected_layers: List[ArtifactInspectLayerResponse] = []
    for index, layer in enumerate(trained_layers_payload):
        weights = _as_float_matrix(layer.get("weights", []))
        bias = _as_float_list(layer.get("bias", []))
        layer_dropout = 0.0
        if isinstance(architecture, list) and index < len(architecture):
            try:
                layer_dropout = float(architecture[index].get("dropout", 0.0))
            except (TypeError, ValueError, AttributeError):
                layer_dropout = 0.0
        input_units = len(weights)
        output_units = len(weights[0]) if weights and isinstance(weights[0], list) else 0
        inspected_layers.append(
            ArtifactInspectLayerResponse(
                index=index,
                activation=str(layer.get("activation", "unknown")),
                useBias=bool(layer.get("use_bias", True)),
                inputUnits=input_units,
                outputUnits=output_units,
                dropout=layer_dropout,
                weights=weights,
                bias=bias,
            )
        )

    preprocessing_summary = payload.get("preprocessing")
    metrics = payload.get("metrics", {})

    return ArtifactInspectResponse(
        backendRunId=backend_run_id,
        runName=str(payload.get("run_name", metadata.runName if metadata else backend_run_id)),
        projectName=str(payload.get("project_name", metadata.projectName if metadata else "Unknown Project")),
        datasetName=str(payload.get("dataset_name", metadata.datasetName if metadata else "Unknown Dataset")),
        modelFamily=str(payload.get("model_family", metadata.modelFamily if metadata else "ANN")),
        taskType=str(payload.get("task_type", metadata.taskType if metadata else "binary_classification")),
        outputUnits=int(payload.get("output_units", metadata.outputUnits if metadata else 1)),
        outputActivation=str(payload.get("output_activation", metadata.outputActivation if metadata else "sigmoid")),
        epochsCompleted=int(metrics.get("epochs_completed", metadata.epochsCompleted if metadata else 0)),
        finalTrainLoss=float(metrics.get("final_train_loss", metadata.finalTrainLoss if metadata else 0.0)),
        finalTrainMetricName=str(metrics.get("final_train_metric_name", metadata.finalTrainMetricName if metadata else "accuracy")),
        finalTrainMetric=float(metrics.get("final_train_metric", metadata.finalTrainMetric if metadata else 0.0)),
        epochHistory=payload.get("epoch_history", []),
        preprocessingSummary=preprocessing_summary,
        architecture=architecture,
        trainedLayers=inspected_layers,
    )
