-- 1. Create btree_gist extension (needed for EXCLUDE constraints on timestamp ranges)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add idempotency_key to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;

-- 3. Create booking_assignment_audits table
CREATE TABLE IF NOT EXISTS booking_assignment_audits (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    prev_teacher UUID REFERENCES teacher_profiles(user_id) ON DELETE SET NULL,
    new_teacher UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_booking_assignment_audits_admin_id ON booking_assignment_audits (admin_id);
CREATE INDEX IF NOT EXISTS ix_booking_assignment_audits_booking_id ON booking_assignment_audits (booking_id);

-- 4. Enforce teacher_assignment_status CHECK constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'bookings' AND constraint_name = 'chk_teacher_assignment_status'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT chk_teacher_assignment_status
        CHECK (teacher_assignment_status IN ('pending', 'assigned', 'failed'));
    END IF;
END $$;

-- 5. Fix duration_minutes default
ALTER TABLE bookings ALTER COLUMN duration_minutes SET DEFAULT 55;

-- 6. Student Exclusion Constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'no_student_double_booking'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT no_student_double_booking
        EXCLUDE USING GIST (
            student_id WITH =,
            tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
        )
        WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
    END IF;
END $$;

-- 7. Teacher Exclusion Constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'no_teacher_double_booking'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT no_teacher_double_booking
        EXCLUDE USING GIST (
            teacher_id WITH =,
            tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
        )
        WHERE (teacher_id IS NOT NULL AND status NOT IN ('cancelled', 'completed', 'no_show'));
    END IF;
END $$;
