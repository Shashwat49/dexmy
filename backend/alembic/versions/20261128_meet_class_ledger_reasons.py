"""Allow Google Meet class-record debits in the package credit ledger.

Revision ID: 20261128_meet_class_ledger_reasons
Revises: 20261012_package_recurring_schedules
"""

from alembic import op


revision = "20261128_meet_class_ledger_reasons"
down_revision = "20261012_package_recurring_schedules"
branch_labels = None
depends_on = None


def upgrade():
    # The teacher/admin Meet class-record workflows create these ledger reasons.
    # Keep all existing booking, purchase, adjustment and unlimited reasons.
    op.execute(
        """
        ALTER TABLE package_credit_ledger
        DROP CONSTRAINT IF EXISTS package_credit_ledger_reason_check
        """
    )
    op.execute(
        """
        ALTER TABLE package_credit_ledger
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
        )
        """
    )


def downgrade():
    op.execute(
        """
        ALTER TABLE package_credit_ledger
        DROP CONSTRAINT IF EXISTS package_credit_ledger_reason_check
        """
    )
    op.execute(
        """
        ALTER TABLE package_credit_ledger
        ADD CONSTRAINT package_credit_ledger_reason_check
        CHECK (
            reason = ANY (
                ARRAY[
                    'purchase',
                    'booking_debit',
                    'booking_refund',
                    'admin_adjustment',
                    'expiry_adjustment',
                    'unlimited_booking'
                ]::text[]
            )
        )
        """
    )
