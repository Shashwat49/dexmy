-- Snapshot package entitlements and total purchase amount at checkout.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS package_class_count INTEGER;

-- Link a ledger debit to its Google Meet class record so the same record cannot
-- be represented by multiple ledger debits.
ALTER TABLE package_credit_ledger
    ADD COLUMN IF NOT EXISTS external_class_record_id UUID
        REFERENCES external_class_records(id) ON DELETE RESTRICT;

ALTER TABLE package_credit_ledger
    ADD CONSTRAINT uq_package_credit_ledger_external_class_record
    UNIQUE (external_class_record_id);

-- Keep the package balance trigger authoritative for Google Meet records.
-- Both completed classes and student no-shows consume a credit. Unlimited
-- packages are recorded in the ledger but their classes_used counter stays 0.
CREATE OR REPLACE FUNCTION public.sync_external_class_package_usage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_billable BOOLEAN := false;
    new_billable BOOLEAN := false;
    delta INTEGER := 0;
    target_package UUID;
    used_count INTEGER;
    total_count INTEGER;
    package_unlimited BOOLEAN;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        old_billable := OLD.status IN ('completed', 'no_show');
    END IF;
    IF TG_OP <> 'DELETE' THEN
        new_billable := NEW.status IN ('completed', 'no_show');
    END IF;

    IF TG_OP = 'INSERT' THEN
        target_package := NEW.student_package_id;
    ELSIF TG_OP = 'DELETE' THEN
        target_package := OLD.student_package_id;
    ELSIF OLD.student_package_id IS DISTINCT FROM NEW.student_package_id
          AND (old_billable OR new_billable) THEN
        IF old_billable THEN
            UPDATE public.student_packages
            SET classes_used = CASE
                WHEN is_unlimited THEN classes_used
                ELSE greatest(0, classes_used - 1)
            END
            WHERE id = OLD.student_package_id;
        END IF;

        IF new_billable THEN
            SELECT is_unlimited, classes_used, total_classes
            INTO package_unlimited, used_count, total_count
            FROM public.student_packages
            WHERE id = NEW.student_package_id
            FOR UPDATE;

            IF NOT package_unlimited AND used_count >= total_count THEN
                RAISE EXCEPTION 'No remaining classes in this package';
            END IF;

            UPDATE public.student_packages
            SET classes_used = CASE
                WHEN is_unlimited THEN classes_used
                ELSE classes_used + 1
            END
            WHERE id = NEW.student_package_id;
        END IF;
        RETURN NEW;
    ELSE
        target_package := NEW.student_package_id;
    END IF;

    delta := CASE
        WHEN new_billable AND NOT old_billable THEN 1
        WHEN old_billable AND NOT new_billable THEN -1
        ELSE 0
    END;

    IF delta = 1 THEN
        SELECT is_unlimited, classes_used, total_classes
        INTO package_unlimited, used_count, total_count
        FROM public.student_packages
        WHERE id = target_package
        FOR UPDATE;

        IF NOT package_unlimited AND used_count >= total_count THEN
            RAISE EXCEPTION 'No remaining classes in this package';
        END IF;

        UPDATE public.student_packages
        SET classes_used = CASE
            WHEN is_unlimited THEN classes_used
            ELSE classes_used + 1
        END
        WHERE id = target_package;
    ELSIF delta = -1 THEN
        UPDATE public.student_packages
        SET classes_used = CASE
            WHEN is_unlimited THEN classes_used
            ELSE greatest(0, classes_used - 1)
        END
        WHERE id = target_package;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS external_class_records_package_usage ON public.external_class_records;
CREATE TRIGGER external_class_records_package_usage
AFTER INSERT OR UPDATE OF status, student_package_id OR DELETE
ON public.external_class_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_external_class_package_usage();
