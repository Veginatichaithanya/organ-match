-- Migration 003: Assign doctor user to Hospital B (Metropolitan)
UPDATE users
SET hospital_id = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0',
    updated_at = NOW()
WHERE email = 'doctor@organmatch.in' OR username = 'doctor';
