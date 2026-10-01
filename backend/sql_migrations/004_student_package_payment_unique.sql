-- Add a UNIQUE constraint to ensure a payment can only be associated with one student_package
-- This prevents duplicate package activations on concurrent webhook / verify requests.
ALTER TABLE student_packages ADD CONSTRAINT uq_student_package_payment_id UNIQUE (payment_id);
