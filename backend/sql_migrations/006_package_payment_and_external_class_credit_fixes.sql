-- Snapshot package entitlements and total purchase amount at checkout.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS package_class_count INTEGER;

-- Link a ledger debit to its Google Meet class record so the same record cannot
-- deduct a package credit more than once.
ALTER TABLE package_credit_ledger
    ADD COLUMN IF NOT EXISTS external_class_record_id UUID
        REFERENCES external_class_records(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_package_credit_ledger_external_class_record
    ON package_credit_ledger(external_class_record_id)
    WHERE external_class_record_id IS NOT NULL;
