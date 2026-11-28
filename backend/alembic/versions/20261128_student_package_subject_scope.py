"""Persist the subject chosen for each package purchase.

Revision ID: 20261128_student_package_subject_scope
Revises: 20261128_package_plan_subjects
"""
from alembic import op
import sqlalchemy as sa


revision = "20261128_student_package_subject_scope"
down_revision = "20261128_package_plan_subjects"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("payments", sa.Column("selected_subject_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_payments_selected_subject_id_subjects",
        "payments",
        "subjects",
        ["selected_subject_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_payments_selected_subject_id", "payments", ["selected_subject_id"])

    op.add_column("student_packages", sa.Column("selected_subject_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_student_packages_selected_subject_id_subjects",
        "student_packages",
        "subjects",
        ["selected_subject_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_student_packages_selected_subject_id", "student_packages", ["selected_subject_id"])


def downgrade():
    op.drop_index("ix_student_packages_selected_subject_id", table_name="student_packages")
    op.drop_constraint("fk_student_packages_selected_subject_id_subjects", "student_packages", type_="foreignkey")
    op.drop_column("student_packages", "selected_subject_id")

    op.drop_index("ix_payments_selected_subject_id", table_name="payments")
    op.drop_constraint("fk_payments_selected_subject_id_subjects", "payments", type_="foreignkey")
    op.drop_column("payments", "selected_subject_id")
