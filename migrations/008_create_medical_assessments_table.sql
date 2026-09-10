-- Migration 008: Create medical_assessments table
CREATE TABLE IF NOT EXISTS medical_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    suitability VARCHAR(20) NOT NULL DEFAULT 'NEEDS_REVIEW',
    risk_level VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    clinical_notes TEXT,
    recommendation TEXT,
    reviewed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_medical_assessments_entity_type ON medical_assessments (entity_type);
CREATE INDEX IF NOT EXISTS ix_medical_assessments_entity_id ON medical_assessments (entity_id);
CREATE INDEX IF NOT EXISTS ix_medical_assessments_reviewed_by ON medical_assessments (reviewed_by);
CREATE INDEX IF NOT EXISTS ix_medical_assessments_created_at ON medical_assessments (created_at);
