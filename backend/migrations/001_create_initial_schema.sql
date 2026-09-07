-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: hospitals
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_hospitals_created_at ON hospitals(created_at);

-- Table: permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255)
);
CREATE INDEX idx_permissions_name ON permissions(name);

-- Table: roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);
CREATE INDEX idx_roles_name ON roles(name);

-- Table: role_permissions (Many-to-Many association)
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Table: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_hospital_id ON users(hospital_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Table: user_roles (Many-to-Many association)
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Table: donors
CREATE TABLE donors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    donor_code VARCHAR(50) NOT NULL UNIQUE,
    age INT NOT NULL,
    blood_group VARCHAR(10) NOT NULL,
    hla_information JSONB DEFAULT '{}'::jsonb NOT NULL,
    medical_details JSONB DEFAULT '{}'::jsonb NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_donors_donor_code ON donors(donor_code);
CREATE INDEX idx_donors_hospital_id ON donors(hospital_id);
CREATE INDEX idx_donors_created_at ON donors(created_at);

-- Table: organs
CREATE TABLE organs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    organ_code VARCHAR(50) NOT NULL UNIQUE,
    organ_type VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10) NOT NULL,
    medical_details JSONB DEFAULT '{}'::jsonb NOT NULL,
    status VARCHAR(20) DEFAULT 'AVAILABLE' NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_organs_organ_code ON organs(organ_code);
CREATE INDEX idx_organs_donor_id ON organs(donor_id);
CREATE INDEX idx_organs_created_at ON organs(created_at);

-- Table: recipients
CREATE TABLE recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
    recipient_code VARCHAR(50) NOT NULL UNIQUE,
    age INT NOT NULL,
    blood_group VARCHAR(10) NOT NULL,
    required_organ VARCHAR(20) NOT NULL,
    medical_details JSONB DEFAULT '{}'::jsonb NOT NULL,
    hla_information JSONB DEFAULT '{}'::jsonb NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
    urgency VARCHAR(20) DEFAULT 'MODERATE' NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_recipients_recipient_code ON recipients(recipient_code);
CREATE INDEX idx_recipients_hospital_id ON recipients(hospital_id);
CREATE INDEX idx_recipients_created_at ON recipients(created_at);

-- Table: matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organ_id UUID NOT NULL REFERENCES organs(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
    compatibility_score DOUBLE PRECISION NOT NULL,
    scoring_breakdown JSONB DEFAULT '{}'::jsonb NOT NULL,
    rank INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_matches_organ_id ON matches(organ_id);
CREATE INDEX idx_matches_recipient_id ON matches(recipient_id);
CREATE INDEX idx_matches_created_at ON matches(created_at);

-- Table: allocations
CREATE TABLE allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
    organ_id UUID NOT NULL REFERENCES organs(id) ON DELETE RESTRICT,
    recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE RESTRICT,
    status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason VARCHAR(255),
    fabric_tx_id VARCHAR(100),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_allocations_match_id ON allocations(match_id);
CREATE INDEX idx_allocations_fabric_tx_id ON allocations(fabric_tx_id);
CREATE INDEX idx_allocations_created_at ON allocations(created_at);

-- Table: audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255) NOT NULL,
    fabric_tx_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_fabric_tx_id ON audit_logs(fabric_tx_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Table: record_versions
CREATE TABLE record_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    version_number INT NOT NULL,
    record_data JSONB NOT NULL,
    record_hash VARCHAR(64) NOT NULL,
    changed_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX idx_record_versions_entity_type ON record_versions(entity_type);
CREATE INDEX idx_record_versions_entity_id ON record_versions(entity_id);
CREATE INDEX idx_record_versions_created_at ON record_versions(created_at);

-- Table: security_events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_code VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    record_id UUID,
    operation VARCHAR(50) NOT NULL,
    tampering_type VARCHAR(50) NOT NULL,
    source VARCHAR(20) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    old_hash VARCHAR(64),
    new_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'DETECTED' NOT NULL,
    fabric_tx_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolved_by UUID
);
CREATE INDEX idx_security_events_event_code ON security_events(event_code);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_record_id ON security_events(record_id);
CREATE INDEX idx_security_events_fabric_tx_id ON security_events(fabric_tx_id);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- Table: blockchain_transactions
CREATE TABLE blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fabric_tx_id VARCHAR(100) NOT NULL UNIQUE,
    record_id UUID NOT NULL,
    record_type VARCHAR(50) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    chaincode VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_blockchain_tx_fabric_tx_id ON blockchain_transactions(fabric_tx_id);
CREATE INDEX idx_blockchain_tx_record_id ON blockchain_transactions(record_id);
CREATE INDEX idx_blockchain_tx_created_at ON blockchain_transactions(created_at);
