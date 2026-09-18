ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS student_package_id UUID
        REFERENCES student_packages(id) ON DELETE RESTRICT;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS teacher_assignment_status VARCHAR(20)
        NOT NULL DEFAULT 'pending';

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE INDEX IF NOT EXISTS ix_bookings_student_package_id
    ON bookings(student_package_id);

CREATE INDEX IF NOT EXISTS ix_bookings_idempotency_key
    ON bookings(idempotency_key);
