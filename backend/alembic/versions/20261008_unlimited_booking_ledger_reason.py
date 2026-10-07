"""Allow unlimited package booking ledger entries.

Revision ID: 20261008_unlimited_booking_ledger_reason
Revises: 20261008_unlimited_test_package
"""

from alembic import op


revision = "20261008_unlimited_booking_ledger_reason"
down_revision = "20261008_unlimited_test_package"
branch_labels = None
depends_on = None


def upgrade():
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
                    'expiry_adjustment'
                ]::text[]
            )
        )
        """
    )
