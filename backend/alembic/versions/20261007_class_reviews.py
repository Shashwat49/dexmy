"""Add post-class teacher and student reviews.
Revision ID: 20261007_class_reviews
Revises: 20260915_classroom_page_identity
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261007_class_reviews"
down_revision = "20260915_classroom_page_identity"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "class_reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_role", sa.String(length=20), nullable=False),
        sa.Column("checked_points", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("additional_opinion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("session_id", "reviewer_id", name="uq_class_review_session_reviewer"),
    )
    op.create_index("idx_class_reviews_session", "class_reviews", ["session_id"])
    op.create_index("idx_class_reviews_reviewer", "class_reviews", ["reviewer_id"])
    op.create_index("idx_class_reviews_reviewee", "class_reviews", ["reviewee_id"])


def downgrade():
    op.drop_index("idx_class_reviews_reviewee", table_name="class_reviews")
    op.drop_index("idx_class_reviews_reviewer", table_name="class_reviews")
    op.drop_index("idx_class_reviews_session", table_name="class_reviews")
    op.drop_table("class_reviews")
