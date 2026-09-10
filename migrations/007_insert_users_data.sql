-- Migration 007: Insert users and assign roles
-- Fixes NULL role_id by ensuring roles and hospitals exist before inserting users and mappings

-- 1. Ensure required roles exist in the roles table
INSERT INTO roles (id, name, description, created_at)
VALUES 
    ('ea78a49a-a02f-450e-82a7-767568ea869c', 'ADMIN', 'System admin', NOW()),
    ('67f2ee3c-2323-4f5f-960f-ebc2cbd84184', 'HOSPITAL_COORDINATOR', 'System hospital coordinator', NOW()),
    ('ddf6b8d3-658a-4429-a85d-efc1a10cb079', 'DOCTOR', 'System doctor', NOW()),
    ('be8a3f0e-5780-4974-8ce5-0d0a021a4d6b', 'ALLOCATION_AUTHORITY', 'System allocation authority', NOW()),
    ('d8d948ef-0370-47ed-9d36-beea32fe094d', 'AUDITOR', 'System auditor', NOW())
ON CONFLICT (name) DO NOTHING;

-- 2. Ensure default hospitals exist if missing
INSERT INTO hospitals (id, name, location, created_at, updated_at)
VALUES
    ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'Hospital A (General Care)', 'New York, USA', NOW(), NOW()),
    ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'Hospital B (Metropolitan)', 'Boston, USA', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Users (Password is 'Password123!' hashed with Argon2id)
INSERT INTO users (
    id,
    hospital_id,
    full_name,
    username,
    email,
    password_hash,
    status,
    must_change_password,
    failed_login_attempts,
    created_at,
    updated_at
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    (SELECT id FROM hospitals WHERE name LIKE 'Hospital A%' LIMIT 1),
    'System Administrator',
    'admin',
    'admin@organmatch.in',
    '$argon2id$v=19$m=65536,t=3,p=4$sBai9N57zxlD6N0bw7i3dg$wD36BAOpY+KDlAKuq6ce6sKJ/WtjRD3SxYnl19l2l1c',
    'Active',
    false,
    0,
    NOW(),
    NOW()
),
(
    '22222222-2222-2222-2222-222222222222',
    (SELECT id FROM hospitals WHERE name LIKE 'Hospital B%' LIMIT 1),
    'Hospital Coordinator',
    'hospital',
    'hospital@organmatch.in',
    '$argon2id$v=19$m=65536,t=3,p=4$sBai9N57zxlD6N0bw7i3dg$wD36BAOpY+KDlAKuq6ce6sKJ/WtjRD3SxYnl19l2l1c',
    'Active',
    false,
    0,
    NOW(),
    NOW()
),
(
    '33333333-3333-3333-3333-333333333333',
    (SELECT id FROM hospitals WHERE name LIKE 'Hospital B%' LIMIT 1),
    'Lead Transplant Surgeon',
    'doctor',
    'doctor@organmatch.in',
    '$argon2id$v=19$m=65536,t=3,p=4$sBai9N57zxlD6N0bw7i3dg$wD36BAOpY+KDlAKuq6ce6sKJ/WtjRD3SxYnl19l2l1c',
    'Active',
    false,
    0,
    NOW(),
    NOW()
),
(
    '44444444-4444-4444-4444-444444444444',
    NULL,
    'National Allocation Officer',
    'transplant',
    'transplant@organmatch.in',
    '$argon2id$v=19$m=65536,t=3,p=4$sBai9N57zxlD6N0bw7i3dg$wD36BAOpY+KDlAKuq6ce6sKJ/WtjRD3SxYnl19l2l1c',
    'Active',
    false,
    0,
    NOW(),
    NOW()
),
(
    '55555555-5555-5555-5555-555555555555',
    NULL,
    'Compliance Auditor',
    'auditor',
    'auditor@organmatch.in',
    '$argon2id$v=19$m=65536,t=3,p=4$sBai9N57zxlD6N0bw7i3dg$wD36BAOpY+KDlAKuq6ce6sKJ/WtjRD3SxYnl19l2l1c',
    'Active',
    false,
    0,
    NOW(),
    NOW()
),
(
    '66666666-6666-6666-6666-666666666666',
    (SELECT id FROM hospitals WHERE name LIKE 'Hospital A%' LIMIT 1),
    'Dr. Sarah Jenkins',
    'dr_jenkins',
    'sarah.jenkins@organmatch.in',
    '$argon2id$v=19$m=65536,t=3,p=4$sBai9N57zxlD6N0bw7i3dg$wD36BAOpY+KDlAKuq6ce6sKJ/WtjRD3SxYnl19l2l1c',
    'Active',
    false,
    0,
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    status = EXCLUDED.status,
    hospital_id = EXCLUDED.hospital_id,
    updated_at = NOW();

-- 4. Map Users to Roles safely using INNER JOINs (prevents NULL role_id violation)
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, NOW()
FROM users u
JOIN roles r ON (
    (u.username = 'admin' AND r.name = 'ADMIN') OR
    (u.username = 'hospital' AND r.name = 'HOSPITAL_COORDINATOR') OR
    (u.username = 'doctor' AND r.name = 'DOCTOR') OR
    (u.username = 'transplant' AND r.name = 'ALLOCATION_AUTHORITY') OR
    (u.username = 'auditor' AND r.name = 'AUDITOR') OR
    (u.username = 'dr_jenkins' AND r.name = 'DOCTOR')
)
ON CONFLICT (user_id, role_id) DO NOTHING;
