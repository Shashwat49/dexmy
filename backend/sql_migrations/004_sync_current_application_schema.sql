-- 004_sync_current_application_schema.sql
-- Sync the local database with the current SQLAlchemy models.
-- This migration is intentionally separate from the authentication work.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. Package plans
-- ============================================================

CREATE TABLE IF NOT EXISTS package_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    class_count INTEGER NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_custom BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Student packages
-- ============================================================

CREATE TABLE IF NOT EXISTS student_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    package_plan_id UUID NOT NULL REFERENCES package_plans(id) ON DELETE RESTRICT,
    payment_id UUID,
    total_classes INTEGER NOT NULL,
    classes_used INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_student_packages_student_id
ON student_packages (student_id);

CREATE INDEX IF NOT EXISTS ix_student_packages_status
ON student_packages (status);

-- ============================================================
-- 3. Payments
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'payment_provider'
    ) THEN
        CREATE TYPE payment_provider AS ENUM ('razorpay', 'stripe');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'payment_status'
    ) THEN
        CREATE TYPE payment_status AS ENUM ('created', 'paid', 'failed', 'refunded');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    package_id UUID REFERENCES student_packages(id) ON DELETE RESTRICT,
    package_plan_id UUID REFERENCES package_plans(id) ON DELETE RESTRICT,
    student_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    payer_id UUID NOT NULL REFERENCES users(id),
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    provider payment_provider NOT NULL,
    provider_order_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    status payment_status NOT NULL DEFAULT 'created',
    idempotency_key UUID UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payments_booking_id
ON payments (booking_id);

CREATE INDEX IF NOT EXISTS ix_payments_package_id
ON payments (package_id);

CREATE INDEX IF NOT EXISTS ix_payments_package_plan_id
ON payments (package_plan_id);

CREATE INDEX IF NOT EXISTS ix_payments_student_id
ON payments (student_id);

CREATE INDEX IF NOT EXISTS ix_payments_provider_order_id
ON payments (provider_order_id);

CREATE INDEX IF NOT EXISTS ix_payments_provider_payment_id
ON payments (provider_payment_id);

CREATE INDEX IF NOT EXISTS ix_payments_status
ON payments (status);

CREATE INDEX IF NOT EXISTS ix_payments_idempotency_key
ON payments (idempotency_key);

-- Complete the circular relationship:
-- student_packages.payment_id -> payments.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'student_packages_payment_id_fkey'
    ) THEN
        ALTER TABLE student_packages
        ADD CONSTRAINT student_packages_payment_id_fkey
        FOREIGN KEY (payment_id)
        REFERENCES payments(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- ============================================================
-- 4. Missing booking columns
-- ============================================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS student_package_id UUID;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS teacher_assignment_status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- Match current Booking model default.
ALTER TABLE bookings
ALTER COLUMN duration_minutes SET DEFAULT 55;

CREATE INDEX IF NOT EXISTS ix_bookings_student_package_id
ON bookings (student_package_id);

CREATE INDEX IF NOT EXISTS ix_bookings_idempotency_key
ON bookings (idempotency_key);

-- Add booking -> student package relationship.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_student_package_id_fkey'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_student_package_id_fkey
        FOREIGN KEY (student_package_id)
        REFERENCES student_packages(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- ============================================================
-- 5. Package credit ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS package_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_package_id UUID NOT NULL REFERENCES student_packages(id) ON DELETE RESTRICT,
    booking_id UUID REFERENCES bookings(id) ON DELETE RESTRICT,
    delta INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_package_credit_ledger_student_package_id
ON package_credit_ledger (student_package_id);

CREATE INDEX IF NOT EXISTS ix_package_credit_ledger_booking_id
ON package_credit_ledger (booking_id);

-- ============================================================
-- 6. Booking idempotency
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_idempotency_key
ON bookings (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ============================================================
-- 7. Teacher assignment status constraint
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_teacher_assignment_status'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT chk_teacher_assignment_status
        CHECK (
            teacher_assignment_status
            IN ('pending', 'assigned', 'failed', 'discarded')
        );
    END IF;
END $$;

-- ============================================================
-- 8. Booking assignment audit
-- ============================================================

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

-- ============================================================
-- 9. Prevent overlapping student bookings
-- ============================================================

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
            tsrange(
                scheduled_at AT TIME ZONE 'UTC',
                (scheduled_at AT TIME ZONE 'UTC')
                    + (duration_minutes * interval '1 minute')
            ) WITH &&
        )
        WHERE (
            status NOT IN ('cancelled', 'completed', 'no_show')
        );
    END IF;
END $$;

-- ============================================================
-- 10. Prevent overlapping teacher bookings
-- ============================================================

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
            tsrange(
                scheduled_at AT TIME ZONE 'UTC',
                (scheduled_at AT TIME ZONE 'UTC')
                    + (duration_minutes * interval '1 minute')
            ) WITH &&
        )
        WHERE (
            teacher_id IS NOT NULL
            AND status NOT IN ('cancelled', 'completed', 'no_show')
        );
    END IF;
END $$;
