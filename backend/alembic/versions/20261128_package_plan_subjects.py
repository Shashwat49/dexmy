"""Add optional subject associations to package plans.

Revision ID: 20261128_package_plan_subjects
Revises: 20261012_package_recurring_schedules
"""
from alembic import op
import sqlalchemy as sa


revision = "20261128_package_plan_subjects"
down_revision = "20261012_package_recurring_schedules"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "package_plan_subjects",
        sa.Column("package_plan_id", sa.UUID(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["package_plan_id"], ["package_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("package_plan_id", "subject_id"),
    )
    op.create_index("ix_package_plan_subjects_subject_id", "package_plan_subjects", ["subject_id"])


def downgrade():
    op.drop_index("ix_package_plan_subjects_subject_id", table_name="package_plan_subjects")
    op.drop_table("package_plan_subjects")
