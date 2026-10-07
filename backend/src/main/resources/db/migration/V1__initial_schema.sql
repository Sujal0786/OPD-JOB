-- CityCare Platform - Initial PostgreSQL Schema
-- Multi-Tenant OPD Token & Remote Patient Registration Platform

CREATE TABLE hospitals (
    id UUID PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    access_code VARCHAR(16) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    logo_url VARCHAR(512),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hospitals_slug ON hospitals(slug);
CREATE INDEX idx_hospitals_access_code ON hospitals(access_code);
CREATE INDEX idx_hospitals_status ON hospitals(status);

CREATE TABLE hospital_users (
    id UUID PRIMARY KEY,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_hospital ON hospital_users(hospital_id);
CREATE INDEX idx_users_email ON hospital_users(email);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES hospital_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE doctors (
    id UUID PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES hospital_users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    photo_url VARCHAR(512),
    specialty VARCHAR(100) NOT NULL,
    qualification VARCHAR(100),
    room_number VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    avg_consultation_minutes INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doctors_hospital ON doctors(hospital_id);
CREATE INDEX idx_doctors_active ON doctors(hospital_id, is_active);

CREATE TABLE opd_sessions (
    id UUID PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_name VARCHAR(50) NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_slot UNIQUE (hospital_id, doctor_id, session_date, session_name)
);

CREATE INDEX idx_sessions_hospital_date ON opd_sessions(hospital_id, session_date);
CREATE INDEX idx_sessions_doctor ON opd_sessions(doctor_id);

CREATE TABLE opd_session_queues (
    id UUID PRIMARY KEY,
    opd_session_id UUID NOT NULL UNIQUE REFERENCES opd_sessions(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    next_token_sequence INT NOT NULL DEFAULT 1,
    current_serving_token INT,
    total_online_count INT NOT NULL DEFAULT 0,
    total_walkin_count INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queues_session ON opd_session_queues(opd_session_id);
CREATE INDEX idx_queues_hospital ON opd_session_queues(hospital_id);

CREATE TABLE opd_tokens (
    id UUID PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    opd_session_id UUID NOT NULL REFERENCES opd_sessions(id) ON DELETE CASCADE,
    token_number INT NOT NULL,
    token_type VARCHAR(20) NOT NULL, -- ONLINE, WALK_IN
    booking_reference VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'WAITING',
    patient_name VARCHAR(255),
    patient_phone VARCHAR(20),
    patient_age INT,
    patient_gender VARCHAR(20),
    reason_for_visit VARCHAR(500),
    created_by_staff_id UUID REFERENCES hospital_users(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_token_number UNIQUE (opd_session_id, token_number)
);

CREATE INDEX idx_tokens_session ON opd_tokens(opd_session_id);
CREATE INDEX idx_tokens_booking_ref ON opd_tokens(booking_reference);
CREATE INDEX idx_tokens_status ON opd_tokens(opd_session_id, status);
CREATE INDEX idx_tokens_search_name ON opd_tokens(hospital_id, patient_name);
CREATE INDEX idx_tokens_search_phone ON opd_tokens(hospital_id, patient_phone);

CREATE TABLE token_lifecycles (
    id BIGSERIAL PRIMARY KEY,
    opd_token_id UUID NOT NULL REFERENCES opd_tokens(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by_user_id UUID REFERENCES hospital_users(id) ON DELETE SET NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lifecycles_token ON token_lifecycles(opd_token_id);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE SET NULL,
    actor_id VARCHAR(64),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(64),
    ip_address VARCHAR(45),
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_hospital ON audit_logs(hospital_id);
CREATE INDEX idx_audit_trace ON audit_logs(trace_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

CREATE TABLE billing_records (
    id UUID PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    opd_session_id UUID NOT NULL REFERENCES opd_sessions(id) ON DELETE CASCADE,
    opd_token_id UUID NOT NULL REFERENCES opd_tokens(id) ON DELETE CASCADE,
    token_number INT NOT NULL,
    is_billable BOOLEAN NOT NULL DEFAULT FALSE,
    amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fee_status VARCHAR(30) NOT NULL DEFAULT 'RECORDED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_hospital ON billing_records(hospital_id);
CREATE INDEX idx_billing_session ON billing_records(opd_session_id);
