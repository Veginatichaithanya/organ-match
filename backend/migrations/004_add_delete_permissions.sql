-- Migration: 004_add_delete_permissions.sql
-- Description: Add delete permissions for hospital records and assign to HOSPITAL_COORDINATOR and ADMIN

INSERT INTO permissions (id, name, description, created_at)
VALUES 
    (gen_random_uuid(), 'DELETE_DONOR', 'Can delete hospital donor record with mandatory justification', NOW()),
    (gen_random_uuid(), 'DELETE_RECIPIENT', 'Can delete hospital recipient record with mandatory justification', NOW()),
    (gen_random_uuid(), 'DELETE_ORGAN', 'Can delete hospital organ record with mandatory justification', NOW())
ON CONFLICT (name) DO NOTHING;

-- Assign DELETE permissions to ADMIN and HOSPITAL_COORDINATOR roles
INSERT INTO role_permissions (role_id, permission_id, assigned_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('ADMIN', 'HOSPITAL_COORDINATOR')
  AND p.name IN ('DELETE_DONOR', 'DELETE_RECIPIENT', 'DELETE_ORGAN')
ON CONFLICT DO NOTHING;
