-- Migration: 005_add_donor_registration_fields.sql
-- Description: Extend donors table with personal details, date of birth, donation preferences, declaration, and registration date.

ALTER TABLE donors
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'Not specified',
ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS residential_address TEXT,
ADD COLUMN IF NOT EXISTS donation_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS declaration_acknowledged BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS registration_date DATE DEFAULT CURRENT_DATE;
