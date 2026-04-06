# Local PostgreSQL for ANN Studio

This setup gives you a local external PostgreSQL instance while developing.

## Option 1: Docker (recommended)

From repository root run:

```powershell
docker compose -f docker-compose.db.yml up -d
```

This starts PostgreSQL with:
- DB: `annstudio`
- User: `annstudio`
- Password: `annstudio`
- Port: `5432`

SQL init files are mounted from:
- `apps/api/src/features/project_management/infrastructure/sql`

## Option 2: Native PostgreSQL

Install PostgreSQL locally and create a database/user matching your `DATABASE_URL`.

## Backend environment

Create `apps/api/.env` from `apps/api/.env.example` and adjust values if needed.

## Run backend

```powershell
Set-Location apps/api/src
"f:/Mis Documentos/Mis Cursos/Models fine tuning/Applications/ANN_Studio/.venv/Scripts/python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Inspect DB

Use DBeaver/pgAdmin with:
- Host: `localhost`
- Port: `5432`
- Database: `annstudio`
- User: `annstudio`
- Password: `annstudio`

Or with psql:

```powershell
psql "postgresql://annstudio:annstudio@localhost:5432/annstudio"
```

## Notes

- `001_init_project_management.sql` creates tenants/users/clients/projects.
- `003_control_plane_foundation.sql` creates base tables for datasets, models, runs, metrics, registry, and audit.
- You must create your tenant/user records in PostgreSQL before calling protected `/api/*` endpoints.
