from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from psycopg import Error as PsycopgError
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

_POOL: Optional[ConnectionPool] = None

ALLOWED_CLIENT_STATUS = {"active", "inactive"}
ALLOWED_PROJECT_STATUS = {"draft", "active", "paused", "archived"}
ALLOWED_NETWORK_TYPES = {"ANN Binary", "ANN Multiclass", "CNN Vision", "Custom Detector"}
ALLOWED_DATASET_TYPES = {"Tabular", "Computer Vision"}
ALLOWED_DATASET_STATUS = {"Ready", "Pending Validation"}


def get_pool() -> ConnectionPool:
    global _POOL

    if _POOL is not None:
        return _POOL

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise HTTPException(
            status_code=503,
            detail="DATABASE_URL is not configured. Set external PostgreSQL connection string.",
        )

    min_size = int(os.getenv("DB_POOL_MIN", "1"))
    max_size = int(os.getenv("DB_POOL_MAX", "8"))
    _POOL = ConnectionPool(conninfo=database_url, min_size=min_size, max_size=max_size, kwargs={"autocommit": True})
    return _POOL


def close_pool() -> None:
    global _POOL
    if _POOL is not None:
        _POOL.close()
        _POOL = None


def run_project_management_migration() -> None:
    sql_dir = Path(__file__).resolve().parent / "sql"
    migration_files = sorted(sql_dir.glob("*.sql"))

    if not migration_files:
        raise HTTPException(status_code=500, detail="No SQL migration files found for project management.")

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            for migration_file in migration_files:
                sql = migration_file.read_text(encoding="utf-8")
                cur.execute(sql)


def _normalize_code(value: str) -> str:
    return "".join(ch for ch in value.strip().upper() if ch.isalnum() or ch == "_")


def _parse_int_id(raw_id: str, field_name: str) -> int:
    token = str(raw_id).strip()
    if not token:
        raise HTTPException(status_code=400, detail=f"{field_name} is required.")
    try:
        value = int(token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be an integer.") from exc
    if value <= 0:
        raise HTTPException(status_code=400, detail=f"{field_name} must be greater than zero.")
    return value


def ensure_tenant_and_user(tenant_id: str, user_id: str) -> None:
    tenant_id_int = _parse_int_id(tenant_id, "X-Tenant-Id")
    user_id_int = _parse_int_id(user_id, "X-User-Id")
    pool = get_pool()

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id FROM tenants WHERE id = %s", (tenant_id_int,))
            tenant = cur.fetchone()
            if not tenant:
                raise HTTPException(status_code=403, detail="Tenant is not registered.")

            cur.execute(
                "SELECT id FROM users WHERE id = %s AND tenant_id = %s AND is_active = TRUE",
                (user_id_int, tenant_id_int),
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=403, detail="User is not active for tenant.")


def list_clients(tenant_id: str, status: Optional[str], q: Optional[str]) -> List[Dict[str, Any]]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    filters = ["tenant_id = %(tenant_id)s", "archived_at_utc IS NULL"]
    params: Dict[str, Any] = {"tenant_id": tenant_id_int}

    if status:
        status_value = status.lower().strip()
        if status_value not in ALLOWED_CLIENT_STATUS:
            raise HTTPException(status_code=400, detail="Invalid client status filter.")
        filters.append("status = %(status)s")
        params["status"] = status_value

    if q:
        filters.append("(code ILIKE %(q)s OR name ILIKE %(q)s)")
        params["q"] = f"%{q.strip()}%"

    query = f"""
        SELECT id, tenant_id, code, name, status, notes, created_by_user_id, created_at_utc, updated_at_utc
        FROM clients
        WHERE {' AND '.join(filters)}
        ORDER BY created_at_utc DESC
    """

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def create_client(
    tenant_id: str,
    user_id: str,
    code: Optional[str],
    name: str,
    status: str,
    notes: Optional[str],
) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    user_id_int = _parse_int_id(user_id, "user_id")
    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Client name is required.")

    status_value = status.lower().strip()
    if status_value not in ALLOWED_CLIENT_STATUS:
        raise HTTPException(status_code=400, detail="Invalid client status.")

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            normalized_code = _normalize_code(code or "")
            if not normalized_code:
                cur.execute(
                    """
                    SELECT code
                    FROM clients
                    WHERE tenant_id = %s
                    """,
                    (tenant_id_int,),
                )
                max_sequence = 0
                for row in cur.fetchall():
                    value = str(row.get("code") or "")
                    if value.startswith("CLI") and value[3:].isdigit():
                        max_sequence = max(max_sequence, int(value[3:]))
                normalized_code = f"CLI{max_sequence + 1:04d}"

            try:
                cur.execute(
                    """
                    INSERT INTO clients (tenant_id, code, name, status, notes, created_by_user_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, tenant_id, code, name, status, notes, created_by_user_id, created_at_utc, updated_at_utc
                    """,
                    (tenant_id_int, normalized_code, normalized_name, status_value, notes, user_id_int),
                )
            except PsycopgError as exc:
                if getattr(exc, "sqlstate", "") == "23505":
                    raise HTTPException(status_code=409, detail="Client code already exists in tenant.") from exc
                raise

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="Unable to persist client.")
            return row


def update_client(
    tenant_id: str,
    client_id: str,
    code: Optional[str],
    name: str,
    status: str,
    notes: Optional[str],
) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    client_id_int = _parse_int_id(client_id, "client_id")
    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Client name is required.")

    status_value = status.lower().strip()
    if status_value not in ALLOWED_CLIENT_STATUS:
        raise HTTPException(status_code=400, detail="Invalid client status.")

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT code
                FROM clients
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                """,
                (client_id_int, tenant_id_int),
            )
            current = cur.fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Client not found.")

            normalized_code = _normalize_code(code or str(current["code"]))
            if not normalized_code:
                raise HTTPException(status_code=400, detail="Client code is required.")

            try:
                cur.execute(
                    """
                    UPDATE clients
                    SET code = %s,
                        name = %s,
                        status = %s,
                        notes = %s,
                        updated_at_utc = NOW()
                    WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                    RETURNING id, tenant_id, code, name, status, notes, created_by_user_id, created_at_utc, updated_at_utc
                    """,
                    (normalized_code, normalized_name, status_value, notes, client_id_int, tenant_id_int),
                )
            except PsycopgError as exc:
                if getattr(exc, "sqlstate", "") == "23505":
                    raise HTTPException(status_code=409, detail="Client code already exists in tenant.") from exc
                raise

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Client not found.")
            return row


def archive_client(tenant_id: str, client_id: str) -> None:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    client_id_int = _parse_int_id(client_id, "client_id")
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id FROM projects
                WHERE tenant_id = %s AND client_id = %s AND archived_at_utc IS NULL
                LIMIT 1
                """,
                (tenant_id_int, client_id_int),
            )
            project = cur.fetchone()
            if project:
                raise HTTPException(status_code=409, detail="Cannot archive client with active projects.")

            cur.execute(
                """
                UPDATE clients
                SET archived_at_utc = NOW(), updated_at_utc = NOW()
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                RETURNING id
                """,
                (client_id_int, tenant_id_int),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Client not found.")


def list_projects(tenant_id: str, client_id: Optional[str], status: Optional[str], q: Optional[str]) -> List[Dict[str, Any]]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    filters = ["p.tenant_id = %(tenant_id)s", "p.archived_at_utc IS NULL"]
    params: Dict[str, Any] = {"tenant_id": tenant_id_int}

    if client_id:
        client_id_int = _parse_int_id(client_id, "client_id")
        filters.append("p.client_id = %(client_id)s")
        params["client_id"] = client_id_int

    if status:
        status_value = status.lower().strip()
        if status_value not in ALLOWED_PROJECT_STATUS:
            raise HTTPException(status_code=400, detail="Invalid project status filter.")
        filters.append("p.status = %(status)s")
        params["status"] = status_value

    if q:
        filters.append("(p.code ILIKE %(q)s OR p.name ILIKE %(q)s)")
        params["q"] = f"%{q.strip()}%"

    query = f"""
        SELECT
            p.id,
            p.tenant_id,
            p.client_id,
            c.name AS client_name,
            p.code,
            p.name,
            p.status,
            p.network_type,
            p.description,
            p.dataset_ids,
            p.model_ids,
            p.model_combinations,
            p.created_by_user_id,
            p.created_at_utc,
            p.updated_at_utc
        FROM projects p
        JOIN clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
        WHERE {' AND '.join(filters)}
        ORDER BY p.created_at_utc DESC
    """

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def create_project(
    tenant_id: str,
    user_id: str,
    client_id: str,
    code: str,
    name: str,
    status: str,
    network_type: str,
    description: Optional[str],
    dataset_ids: List[str],
    model_ids: List[str],
    model_combinations: List[str],
) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    user_id_int = _parse_int_id(user_id, "user_id")
    client_id_int = _parse_int_id(client_id, "client_id")
    normalized_code = _normalize_code(code)
    if not normalized_code:
        raise HTTPException(status_code=400, detail="Project code is required.")

    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Project name is required.")

    status_value = status.lower().strip()
    if status_value not in ALLOWED_PROJECT_STATUS:
        raise HTTPException(status_code=400, detail="Invalid project status.")

    if network_type not in ALLOWED_NETWORK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid project network type.")

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id FROM clients
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                """,
                (client_id_int, tenant_id_int),
            )
            client = cur.fetchone()
            if not client:
                raise HTTPException(status_code=404, detail="Client not found in tenant.")

            try:
                cur.execute(
                    """
                    INSERT INTO projects (
                        tenant_id, client_id, code, name, status, network_type, description,
                        dataset_ids, model_ids, model_combinations, created_by_user_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, tenant_id, client_id, code, name, status, network_type, description,
                        dataset_ids, model_ids, model_combinations, created_by_user_id, created_at_utc, updated_at_utc
                    """,
                    (
                        tenant_id_int,
                        client_id_int,
                        normalized_code,
                        normalized_name,
                        status_value,
                        network_type,
                        description,
                        Jsonb(dataset_ids),
                        Jsonb(model_ids),
                        Jsonb(model_combinations),
                        user_id_int,
                    ),
                )
            except PsycopgError as exc:
                if getattr(exc, "sqlstate", "") == "23505":
                    raise HTTPException(status_code=409, detail="Project code already exists in tenant.") from exc
                raise

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="Unable to persist project.")
            return row


def update_project(
    tenant_id: str,
    project_id: str,
    client_id: str,
    code: str,
    name: str,
    status: str,
    network_type: str,
    description: Optional[str],
    dataset_ids: List[str],
    model_ids: List[str],
    model_combinations: List[str],
) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    project_id_int = _parse_int_id(project_id, "project_id")
    client_id_int = _parse_int_id(client_id, "client_id")
    normalized_code = _normalize_code(code)
    if not normalized_code:
        raise HTTPException(status_code=400, detail="Project code is required.")

    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Project name is required.")

    status_value = status.lower().strip()
    if status_value not in ALLOWED_PROJECT_STATUS:
        raise HTTPException(status_code=400, detail="Invalid project status.")

    if network_type not in ALLOWED_NETWORK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid project network type.")

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id FROM clients
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                """,
                (client_id_int, tenant_id_int),
            )
            client = cur.fetchone()
            if not client:
                raise HTTPException(status_code=404, detail="Client not found in tenant.")

            try:
                cur.execute(
                    """
                    UPDATE projects
                    SET client_id = %s,
                        code = %s,
                        name = %s,
                        status = %s,
                        network_type = %s,
                        description = %s,
                        dataset_ids = %s,
                        model_ids = %s,
                        model_combinations = %s,
                        updated_at_utc = NOW()
                    WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                    RETURNING id, tenant_id, client_id, code, name, status, network_type, description,
                        dataset_ids, model_ids, model_combinations, created_by_user_id, created_at_utc, updated_at_utc
                    """,
                    (
                        client_id_int,
                        normalized_code,
                        normalized_name,
                        status_value,
                        network_type,
                        description,
                        Jsonb(dataset_ids),
                        Jsonb(model_ids),
                        Jsonb(model_combinations),
                        project_id_int,
                        tenant_id_int,
                    ),
                )
            except PsycopgError as exc:
                if getattr(exc, "sqlstate", "") == "23505":
                    raise HTTPException(status_code=409, detail="Project code already exists in tenant.") from exc
                raise

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Project not found.")
            return row


def archive_project(tenant_id: str, project_id: str) -> None:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    project_id_int = _parse_int_id(project_id, "project_id")
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE projects
                SET archived_at_utc = NOW(), updated_at_utc = NOW()
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                RETURNING id
                """,
                (project_id_int, tenant_id_int),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Project not found.")


def _validate_dataset_type_and_status(dataset_type: str, status: str) -> tuple[str, str]:
    normalized_type = dataset_type.strip()
    if normalized_type not in ALLOWED_DATASET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid dataset type.")

    normalized_status = status.strip()
    if normalized_status not in ALLOWED_DATASET_STATUS:
        raise HTTPException(status_code=400, detail="Invalid dataset status.")

    return normalized_type, normalized_status


def _validate_projects_for_tenant(cur: Any, tenant_id: str, project_ids: List[str]) -> List[str]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    normalized: List[str] = []
    normalized_int_ids: List[int] = []
    seen = set()
    for project_id in project_ids:
        token_int = _parse_int_id(str(project_id), "project_id")
        token = str(token_int)
        if not token or token in seen:
            continue
        seen.add(token)
        normalized.append(token)
        normalized_int_ids.append(token_int)

    if not normalized:
        raise HTTPException(status_code=400, detail="At least one project must be assigned to the dataset.")

    cur.execute(
        """
        SELECT id
        FROM projects
        WHERE tenant_id = %s
          AND archived_at_utc IS NULL
                    AND id = ANY(%s::bigint[])
        """,
                (tenant_id_int, normalized_int_ids),
    )
    found = {str(row["id"]) for row in cur.fetchall()}
    missing = [project_id for project_id in normalized if project_id not in found]
    if missing:
        raise HTTPException(status_code=404, detail="One or more selected projects were not found in tenant.")

    return normalized


def _remove_dataset_from_all_projects(cur: Any, tenant_id: str, dataset_id: str) -> None:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    dataset_id_int = _parse_int_id(dataset_id, "dataset_id")
    dataset_id_token = str(dataset_id_int)
    cur.execute(
        """
        UPDATE projects
        SET dataset_ids = COALESCE(
              (
                SELECT jsonb_agg(value)
                FROM jsonb_array_elements_text(COALESCE(dataset_ids, '[]'::jsonb)) AS value
                WHERE value <> %s
              ),
              '[]'::jsonb
            ),
            updated_at_utc = NOW()
        WHERE tenant_id = %s
          AND archived_at_utc IS NULL
          AND dataset_ids ? %s
        """,
        (dataset_id_token, tenant_id_int, dataset_id_token),
    )


def _assign_dataset_to_projects(cur: Any, tenant_id: str, dataset_id: str, project_ids: List[str]) -> None:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    dataset_id_int = _parse_int_id(dataset_id, "dataset_id")
    dataset_id_token = str(dataset_id_int)
    for project_id in project_ids:
        project_id_int = _parse_int_id(project_id, "project_id")
        cur.execute(
            """
            UPDATE projects
            SET dataset_ids = CASE
                WHEN COALESCE(dataset_ids, '[]'::jsonb) ? %s
                    THEN COALESCE(dataset_ids, '[]'::jsonb)
                ELSE COALESCE(dataset_ids, '[]'::jsonb) || jsonb_build_array(%s::text)
            END,
            updated_at_utc = NOW()
            WHERE id = %s
              AND tenant_id = %s
              AND archived_at_utc IS NULL
            """,
            (dataset_id_token, dataset_id_token, project_id_int, tenant_id_int),
        )


def _fetch_dataset_by_id(cur: Any, tenant_id: str, dataset_id: str) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    dataset_id_int = _parse_int_id(dataset_id, "dataset_id")
    cur.execute(
        """
        SELECT
            d.id,
            d.tenant_id,
            d.project_id,
            d.code,
            d.name,
            d.dataset_type,
            d.status,
            d.created_by_user_id,
            d.created_at_utc,
            d.updated_at_utc,
            (
              SELECT COUNT(*)::integer
              FROM dataset_versions dv
              WHERE dv.tenant_id = d.tenant_id AND dv.dataset_id = d.id
            ) AS versions,
            COALESCE(
              (
                SELECT jsonb_agg(p.id)
                FROM projects p
                WHERE p.tenant_id = d.tenant_id
                  AND p.archived_at_utc IS NULL
                  AND p.dataset_ids ? (d.id::text)
              ),
              '[]'::jsonb
            ) AS project_ids
        FROM datasets d
        WHERE d.id = %s
          AND d.tenant_id = %s
          AND d.archived_at_utc IS NULL
        """,
        (dataset_id_int, tenant_id_int),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return row


def list_datasets(tenant_id: str, project_id: Optional[str], status: Optional[str], q: Optional[str]) -> List[Dict[str, Any]]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    filters = ["d.tenant_id = %(tenant_id)s", "d.archived_at_utc IS NULL"]
    params: Dict[str, Any] = {"tenant_id": tenant_id_int}

    if status:
        status_token = status.strip()
        if status_token not in ALLOWED_DATASET_STATUS:
            raise HTTPException(status_code=400, detail="Invalid dataset status filter.")
        filters.append("d.status = %(status)s")
        params["status"] = status_token

    if q:
        filters.append("(d.code ILIKE %(q)s OR d.name ILIKE %(q)s)")
        params["q"] = f"%{q.strip()}%"

    if project_id:
        project_id_int = _parse_int_id(project_id.strip(), "project_id")
        filters.append(
            """
            EXISTS (
                SELECT 1
                FROM projects p
                WHERE p.id = %(project_id)s
                  AND p.tenant_id = d.tenant_id
                  AND p.archived_at_utc IS NULL
                  AND p.dataset_ids ? (d.id::text)
            )
            """
        )
        params["project_id"] = project_id_int

    query = f"""
        SELECT
            d.id,
            d.tenant_id,
            d.project_id,
            d.code,
            d.name,
            d.dataset_type,
            d.status,
            d.created_by_user_id,
            d.created_at_utc,
            d.updated_at_utc,
            (
              SELECT COUNT(*)::integer
              FROM dataset_versions dv
              WHERE dv.tenant_id = d.tenant_id AND dv.dataset_id = d.id
            ) AS versions,
            COALESCE(
              (
                SELECT jsonb_agg(p.id)
                FROM projects p
                WHERE p.tenant_id = d.tenant_id
                  AND p.archived_at_utc IS NULL
                  AND p.dataset_ids ? (d.id::text)
              ),
              '[]'::jsonb
            ) AS project_ids
        FROM datasets d
        WHERE {' AND '.join(filters)}
        ORDER BY d.created_at_utc DESC
    """

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def create_dataset(
    tenant_id: str,
    user_id: str,
    code: Optional[str],
    name: str,
    dataset_type: str,
    status: str,
    project_ids: List[str],
) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    user_id_int = _parse_int_id(user_id, "user_id")
    normalized_code = _normalize_code(code or name)
    if not normalized_code:
        raise HTTPException(status_code=400, detail="Dataset code is required.")

    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Dataset name is required.")

    normalized_type, normalized_status = _validate_dataset_type_and_status(dataset_type=dataset_type, status=status)

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            validated_project_ids = _validate_projects_for_tenant(cur=cur, tenant_id=tenant_id, project_ids=project_ids)
            primary_project_id = int(validated_project_ids[0])

            try:
                cur.execute(
                    """
                    INSERT INTO datasets (tenant_id, project_id, code, name, dataset_type, status, created_by_user_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, tenant_id, project_id, code, name, dataset_type, status,
                        created_by_user_id, created_at_utc, updated_at_utc
                    """,
                    (
                        tenant_id_int,
                        primary_project_id,
                        normalized_code,
                        normalized_name,
                        normalized_type,
                        normalized_status,
                        user_id_int,
                    ),
                )
            except PsycopgError as exc:
                if getattr(exc, "sqlstate", "") == "23505":
                    raise HTTPException(status_code=409, detail="Dataset code already exists in tenant.") from exc
                raise

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="Unable to persist dataset.")

            dataset_id_int = int(row["id"])
            cur.execute(
                """
                INSERT INTO dataset_versions (
                    tenant_id,
                    dataset_id,
                    version_number,
                    storage_kind,
                    storage_uri,
                    schema_fingerprint,
                    split_policy,
                    published_by_user_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, dataset_id, version_number) DO NOTHING
                """,
                (tenant_id_int, dataset_id_int, 1, "filesystem", "pending://dataset", None, Jsonb({}), user_id_int),
            )

            _assign_dataset_to_projects(
                cur=cur,
                tenant_id=str(tenant_id_int),
                dataset_id=str(dataset_id_int),
                project_ids=validated_project_ids,
            )

            return _fetch_dataset_by_id(cur=cur, tenant_id=str(tenant_id_int), dataset_id=str(dataset_id_int))


def update_dataset(
    tenant_id: str,
    dataset_id: str,
    code: Optional[str],
    name: str,
    dataset_type: str,
    status: str,
    project_ids: List[str],
) -> Dict[str, Any]:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    dataset_id_int = _parse_int_id(dataset_id, "dataset_id")
    normalized_name = name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Dataset name is required.")

    normalized_type, normalized_status = _validate_dataset_type_and_status(dataset_type=dataset_type, status=status)

    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            validated_project_ids = _validate_projects_for_tenant(cur=cur, tenant_id=tenant_id, project_ids=project_ids)
            primary_project_id = int(validated_project_ids[0])

            cur.execute(
                """
                SELECT code
                FROM datasets
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                """,
                (dataset_id_int, tenant_id_int),
            )
            existing = cur.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Dataset not found.")

            normalized_code = _normalize_code(code or str(existing["code"]))
            if not normalized_code:
                raise HTTPException(status_code=400, detail="Dataset code is required.")

            try:
                cur.execute(
                    """
                    UPDATE datasets
                    SET project_id = %s,
                        code = %s,
                        name = %s,
                        dataset_type = %s,
                        status = %s,
                        updated_at_utc = NOW()
                    WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                    RETURNING id
                    """,
                    (
                        primary_project_id,
                        normalized_code,
                        normalized_name,
                        normalized_type,
                        normalized_status,
                        dataset_id_int,
                        tenant_id_int,
                    ),
                )
            except PsycopgError as exc:
                if getattr(exc, "sqlstate", "") == "23505":
                    raise HTTPException(status_code=409, detail="Dataset code already exists in tenant.") from exc
                raise

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Dataset not found.")

            _remove_dataset_from_all_projects(cur=cur, tenant_id=str(tenant_id_int), dataset_id=str(dataset_id_int))
            _assign_dataset_to_projects(
                cur=cur,
                tenant_id=str(tenant_id_int),
                dataset_id=str(dataset_id_int),
                project_ids=validated_project_ids,
            )

            return _fetch_dataset_by_id(cur=cur, tenant_id=str(tenant_id_int), dataset_id=str(dataset_id_int))


def archive_dataset(tenant_id: str, dataset_id: str) -> None:
    tenant_id_int = _parse_int_id(tenant_id, "tenant_id")
    dataset_id_int = _parse_int_id(dataset_id, "dataset_id")
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            _remove_dataset_from_all_projects(cur=cur, tenant_id=str(tenant_id_int), dataset_id=str(dataset_id_int))
            cur.execute(
                """
                UPDATE datasets
                SET archived_at_utc = NOW(), updated_at_utc = NOW()
                WHERE id = %s AND tenant_id = %s AND archived_at_utc IS NULL
                RETURNING id
                """,
                (dataset_id_int, tenant_id_int),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Dataset not found.")
