-- Booking concurrency and assignment-audit safeguards.
-- Keep this migration idempotent: production may already contain some or all
-- of these objects from an earlier manual rollout.

-- 1. Required for GiST exclusion constraints that combine UUID equality
--    with a generated timestamp range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Idempotency key for retry-safe booking creation.
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_idempotency_key
    ON bookings (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 3. Immutable assignment audit trail.
CREATE TABLE IF NOT EXISTS booking_assignment_audits (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    prev_teacher UUID REFERENCES teacher_profiles(user_id) ON DELETE SET NULL,
    new_teacher UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE RESTRICT,
    action VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_booking_assignment_audits_admin_id
    ON booking_assignment_audits (admin_id);
CREATE INDEX IF NOT EXISTS ix_booking_assignment_audits_booking_id
    ON booking_assignment_audits (booking_id);

-- 4. Match the application enum, including the existing 'discarded' state.
--    Repair an older version of this check constraint only when it is missing
--    the discarded value; do not churn the already-correct production constraint.
DO $$
DECLARE
    check_definition TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid)
      INTO check_definition
      FROM pg_constraint
     WHERE conrelid = 'bookings'::regclass
       AND conname = 'chk_teacher_assignment_status'
       AND contype = 'c';

    IF check_definition IS NULL THEN
        ALTER TABLE bookings
            ADD CONSTRAINT chk_teacher_assignment_status
            CHECK (teacher_assignment_status IN ('pending', 'assigned', 'failed', 'discarded'));
    ELSIF position('discarded' IN check_definition) = 0 THEN
        ALTER TABLE bookings
            DROP CONSTRAINT chk_teacher_assignment_status;

        ALTER TABLE bookings
            ADD CONSTRAINT chk_teacher_assignment_status
            CHECK (teacher_assignment_status IN ('pending', 'assigned', 'failed', 'discarded'));
    END IF;
END
$$;

-- 5. Keep the actual class end timestamp available to the application.
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS booking_ends_at TIMESTAMPTZ;

UPDATE bookings
   SET booking_ends_at = scheduled_at + make_interval(mins => duration_minutes)
 WHERE booking_ends_at IS NULL;

ALTER TABLE bookings
    ALTER COLUMN booking_ends_at SET NOT NULL;

-- 6. Use a STORED generated tsrange for overlap checks.
--
--    Do NOT put tstzrange(scheduled_at, scheduled_at + interval) directly in
--    an EXCLUDE expression: timestamptz + interval depends on the session
--    timezone/DST rules and PostgreSQL rejects that expression as non-IMMUTABLE.
--    Converting the start to UTC first gives a timezone-free timestamp; adding
--    an integer-minute interval is immutable. This is the same generated
--    expression already used by the production database.
--
--    If a previous failed run left behind the old ordinary (non-generated)
--    column, remove only the two known constraints that depend on it and
--    rebuild the derived column. Unknown dependencies cause a safe failure
--    rather than being cascaded away.
DO $$
DECLARE
    generated_kind "char";
BEGIN
    SELECT attgenerated
      INTO generated_kind
      FROM pg_attribute
     WHERE attrelid = 'bookings'::regclass
       AND attname = 'booking_time_range'
       AND NOT attisdropped;

    IF generated_kind IS NOT NULL AND generated_kind = '' THEN
        ALTER TABLE bookings
            DROP CONSTRAINT IF EXISTS no_student_double_booking;
        ALTER TABLE bookings
            DROP CONSTRAINT IF EXISTS no_teacher_double_booking;
        ALTER TABLE bookings
            DROP COLUMN booking_time_range;
    END IF;
END
$$;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS booking_time_range TSRANGE
    GENERATED ALWAYS AS (
        tsrange(
            scheduled_at AT TIME ZONE 'UTC',
            (scheduled_at AT TIME ZONE 'UTC') + make_interval(mins => duration_minutes),
            '[)'
        )
    ) STORED;

-- 7. Preserve the existing 55-minute default used by the booking system.
ALTER TABLE bookings
    ALTER COLUMN duration_minutes SET DEFAULT 55;

-- 8. Student overlap protection. Cancelled, completed, and no-show bookings
--    do not reserve a slot.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'bookings'::regclass
           AND conname = 'no_student_double_booking'
           AND contype = 'x'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT no_student_double_booking
            EXCLUDE USING GIST (
                student_id WITH =,
                booking_time_range WITH &&
            )
            WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
    END IF;
END
$$;

-- 9. Teacher overlap protection, including only bookings with an assigned
--    teacher. The partial predicate preserves unassigned booking behaviour.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'bookings'::regclass
           AND conname = 'no_teacher_double_booking'
           AND contype = 'x'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT no_teacher_double_booking
            EXCLUDE USING GIST (
                teacher_id WITH =,
                booking_time_range WITH &&
            )
            WHERE (
                teacher_id IS NOT NULL
                AND status NOT IN ('cancelled', 'completed', 'no_show')
            );
    END IF;
END
$$;
