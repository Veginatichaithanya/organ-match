-- Migration 004: Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    organization VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    result VARCHAR(20) NOT NULL,
    reason VARCHAR(255),
    ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    user_agent VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    fabric_tx_id VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_fabric_tx_id ON audit_logs(fabric_tx_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);
