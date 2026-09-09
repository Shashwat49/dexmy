"""Add student account detail fields.

Revision ID: 20260909_student_account_details
Revises: 20260909_external_class_records
"""
from alembic import op
import sqlalchemy as sa

revision = "20260909_student_account_details"
down_revision = "20260909_external_class_records"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("student_profiles", sa.Column("gender", sa.String(length=30), nullable=True))
    op.add_column("student_profiles", sa.Column("address", sa.String(length=500), nullable=True))
    op.add_column("student_profiles", sa.Column("city", sa.String(length=100), nullable=True))
    op.add_column("student_profiles", sa.Column("country", sa.String(length=100), nullable=True))
    op.add_column("student_profiles", sa.Column("board", sa.String(length=100), nullable=True))
    op.add_column("student_profiles", sa.Column("academic_year", sa.String(length=30), nullable=True))
    op.add_column("student_profiles", sa.Column("subjects", sa.String(length=500), nullable=True))
    op.add_column("student_profiles", sa.Column("student_id_number", sa.String(length=100), nullable=True))
    op.add_column("student_profiles", sa.Column("parent_name", sa.String(length=255), nullable=True))
    op.add_column("student_profiles", sa.Column("parent_email", sa.String(length=255), nullable=True))
    op.add_column("student_profiles", sa.Column("parent_phone", sa.String(length=20), nullable=True))
    op.add_column("student_profiles", sa.Column("parent_relationship", sa.String(length=50), nullable=True))
    op.add_column("student_profiles", sa.Column("parent_occupation", sa.String(length=150), nullable=True))


def downgrade():
    for column in [
        "parent_occupation", "parent_relationship", "parent_phone", "parent_email", "parent_name",
        "student_id_number", "subjects", "academic_year", "board", "country", "city", "address", "gender",
    ]:
        op.drop_column("student_profiles", column)
