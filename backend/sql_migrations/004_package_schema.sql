-- 004_package_schema.sql
-- Create the package/payment schema required by the application models.
-- This migration is idempotent and preserves existing data.

-- ============================================================
-- 1. Package plans
-- ============================================================

CREATE TABLE IF NOT EXISTS package_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    class_count INTEGER NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_custom BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Payment enum types
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'payment_provider'
    ) THEN
        CREATE TYPE payment_provider AS ENUM (
            'razorpay',
            'stripe'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'payment_status'
    ) THEN
        CREATE TYPE payment_status AS ENUM (
            'created',
            'paid',
            'failed',
            'refunded'
        );
    END IF;
END
$$;

-- ============================================================
-- 3. Payments
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    booking_id UUID
        REFERENCES bookings(id)
        ON DELETE CASCADE,
    package_id UUID,
    package_plan_id UUID
        REFERENCES package_plans(id)
        ON DELETE RESTRICT,
    student_id UUID
        REFERENCES users(id)
        ON DELETE RESTRICT,
    payer_id UUID NOT NULL
        REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    provider payment_provider NOT NULL,
    provider_order_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    status payment_status NOT NULL DEFAULT 'created',
    idempotency_key UUID UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_payments_booking_id
    ON payments(booking_id);

CREATE INDEX IF NOT EXISTS ix_payments_package_id
    ON payments(package_id);

CREATE INDEX IF NOT EXISTS ix_payments_package_plan_id
    ON payments(package_plan_id);

CREATE INDEX IF NOT EXISTS ix_payments_student_id
    ON payments(student_id);

CREATE INDEX IF NOT EXISTS ix_payments_provider_order_id
    ON payments(provider_order_id);

CREATE INDEX IF NOT EXISTS ix_payments_provider_payment_id
    ON payments(provider_payment_id);

CREATE INDEX IF NOT EXISTS ix_payments_status
    ON payments(status);

CREATE INDEX IF NOT EXISTS ix_payments_idempotency_key
    ON payments(idempotency_key);

-- ============================================================
-- 4. Student packages
-- ============================================================

CREATE TABLE IF NOT EXISTS student_packages (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,
    package_plan_id UUID NOT NULL
        REFERENCES package_plans(id)
        ON DELETE RESTRICT,
    payment_id UUID
        REFERENCES payments(id)
        ON DELETE RESTRICT,
    total_classes INTEGER NOT NULL,
    classes_used INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_student_packages_student_id
    ON student_packages(student_id);

CREATE INDEX IF NOT EXISTS ix_student_packages_status
    ON student_packages(status);

-- ============================================================
-- 5. Complete circular payment ? student_package relationship
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_payments_package_id_student_packages'
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT fk_payments_package_id_student_packages
        FOREIGN KEY (package_id)
        REFERENCES student_packages(id)
        ON DELETE RESTRICT;
    END IF;
END
$$;

-- ============================================================
-- 6. Package credit ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS package_credit_ledger (
    id UUID PRIMARY KEY,
    student_package_id UUID NOT NULL
        REFERENCES student_packages(id)
        ON DELETE RESTRICT,
    booking_id UUID
        REFERENCES bookings(id)
        ON DELETE RESTRICT,
    delta INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,
    created_by UUID
        REFERENCES users(id)
        ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_package_credit_ledger_student_package_id
    ON package_credit_ledger(student_package_id);

CREATE INDEX IF NOT EXISTS ix_package_credit_ledger_booking_id
    ON package_credit_ledger(booking_id);

CREATE INDEX IF NOT EXISTS ix_package_credit_ledger_created_by
    ON package_credit_ledger(created_by);
