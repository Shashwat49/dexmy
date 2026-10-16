-- Apply this migration to the production PostgreSQL database before enabling
-- CLASS_REMINDERS_ENABLED on the production backend.
CREATE TABLE IF NOT EXISTS booking_reminder_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('student', 'teacher')),
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
    sent_at TIMESTAMPTZ NULL,
    last_error VARCHAR(1000) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_booking_reminder_booking_recipient UNIQUE (booking_id, recipient_type)
);

CREATE INDEX IF NOT EXISTS ix_booking_reminder_deliveries_booking_id
    ON booking_reminder_deliveries (booking_id);
