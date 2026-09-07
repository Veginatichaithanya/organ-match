-- Migration 003: Create medical_assessments table for Doctor clinical review workflow
-- Medical assessments are separate from donor/organ/recipient records.
-- Doctors add clinical notes, suitability decisions, and recommendations per entity.

CREATE TABLE medical_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- The entity under review (polymorphic reference)
    entity_type VARCHAR(30) NOT NULL,   -- 'Donor' | 'Recipient' | 'Organ' | 'Match'
    entity_id   UUID        NOT NULL,

    -- Clinical decision fields
    suitability VARCHAR(20) NOT NULL DEFAULT 'NEEDS_REVIEW',
    -- Values: 'APPROVED' | 'NOT_APPROVED' | 'NEEDS_REVIEW'

    risk_level  VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    -- Values: 'LOW' | 'MEDIUM' | 'HIGH'

    clinical_notes TEXT,
    recommendation TEXT,

    -- Reviewer identity
    reviewed_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Audit metadata
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_medical_assessments_entity ON medical_assessments(entity_type, entity_id);
CREATE INDEX idx_medical_assessments_reviewed_by ON medical_assessments(reviewed_by);
CREATE INDEX idx_medical_assessments_created_at ON medical_assessments(created_at);
