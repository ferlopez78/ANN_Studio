# Project Management Persistence (PostgreSQL)

This slice enables tenant-aware ABM for clients and projects in external PostgreSQL.

## Required environment variables

- DATABASE_URL: PostgreSQL connection string
- DB_POOL_MIN: optional, default 1
- DB_POOL_MAX: optional, default 8
- AUTO_MIGRATE_PROJECT_DB: optional, default true

## Runtime tenant context headers (MVP)

All `/api/clients` and `/api/projects` endpoints require:

- X-Tenant-Id
- X-User-Id

These headers emulate identity claims until auth integration is completed.

## Migration SQL

- 001_init_project_management.sql
- 002_seed_example.sql
- 003_control_plane_foundation.sql

When AUTO_MIGRATE_PROJECT_DB is true, schema migration 001 runs at API startup.

See full local DB instructions at `docs/local-postgres-development.md`.
