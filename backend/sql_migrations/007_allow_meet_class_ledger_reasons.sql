-- Allow Google Meet class records to write their corresponding package-credit
-- ledger entries. Preserve every existing allowed reason.
--
-- Apply once to the Dexmy production PostgreSQL database before deploying
-- the class-recording fix.

BEGIN;

ALTER TABLE public.package_credit_ledger
    DROP CONSTRAINT IF EXISTS package_credit_ledger_reason_check;

ALTER TABLE public.package_credit_ledger
    ADD CONSTRAINT package_credit_ledger_reason_check
    CHECK (
        reason = ANY (
            ARRAY[
                'purchase',
                'booking_debit',
                'booking_refund',
                'admin_adjustment',
                'expiry_adjustment',
                'unlimited_booking',
                'external_class_debit',
                'external_class_no_show'
            ]::text[]
        )
    );

COMMIT;
