"""Add explicit unlimited package support for testing accounts.

Revision ID: 20261008_unlimited_test_package
Revises: 20261007_class_reviews
"""
from alembic import op
import sqlalchemy as sa


revision = "20261008_unlimited_test_package"
down_revision = "20261007_class_reviews"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "student_packages",
        sa.Column("is_unlimited", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE student_packages sp
        SET is_unlimited = TRUE,
            total_classes = 2147483647,
            classes_used = (
                SELECT COUNT(*)
                FROM class_sessions cs
                JOIN bookings b ON b.id = cs.booking_id
                WHERE b.student_id = sp.student_id
                  AND b.student_package_id = sp.id
                  AND cs.status = 'ended'
                  AND cs.started_at IS NOT NULL
                  AND cs.ended_at IS NOT NULL
            )
        WHERE sp.id = (
            SELECT sp2.id
            FROM student_packages sp2
            JOIN users u ON u.id = sp2.student_id
            WHERE lower(u.email) = lower('wargod3508@gmail.com')
              AND sp2.status = 'active'
            ORDER BY sp2.created_at DESC
            LIMIT 1
        )
        """
    )


def downgrade():
    op.drop_column("student_packages", "is_unlimited")
