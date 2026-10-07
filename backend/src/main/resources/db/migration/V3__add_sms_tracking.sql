-- Flyway Migration V3: Add SMS delivery status and error tracking to opd_tokens
ALTER TABLE opd_tokens ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE opd_tokens ADD COLUMN IF NOT EXISTS sms_error VARCHAR(500);
