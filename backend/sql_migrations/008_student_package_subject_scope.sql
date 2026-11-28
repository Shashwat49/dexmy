-- Persist a student's selected subject for each new package purchase.
-- Additive and safe to run more than once; existing purchases remain unscoped.
BEGIN;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS selected_subject_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'payments'::regclass
           AND conname = 'fk_payments_selected_subject_id_subjects'
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT fk_payments_selected_subject_id_subjects
            FOREIGN KEY (selected_subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_payments_selected_subject_id
    ON payments (selected_subject_id);

ALTER TABLE student_packages
    ADD COLUMN IF NOT EXISTS selected_subject_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'student_packages'::regclass
           AND conname = 'fk_student_packages_selected_subject_id_subjects'
    ) THEN
        ALTER TABLE student_packages
            ADD CONSTRAINT fk_student_packages_selected_subject_id_subjects
            FOREIGN KEY (selected_subject_id) REFERENCES subjects(id) ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_student_packages_selected_subject_id
    ON student_packages (selected_subject_id);

COMMIT;
