-- Example seed for local/testing environments.
-- Replace IDs/emails before use in shared environments.

INSERT INTO tenants (id, code, name)
OVERRIDING SYSTEM VALUE
VALUES (1, 'BRAIZE', 'Braize Workspace')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, display_name, role, is_active)
OVERRIDING SYSTEM VALUE
VALUES (
  1,
  1,
  'admin@braize.local',
  'Tenant Admin',
  'tenant-admin',
  TRUE
)
ON CONFLICT (id) DO NOTHING;
