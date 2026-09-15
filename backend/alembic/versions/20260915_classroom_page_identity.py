"""Add stable classroom page identities and ordering.
Revision ID: 20260915_classroom_page_identity
Revises: 20260909_student_account_details
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = "20260915_classroom_page_identity"
down_revision = "20260909_student_account_details"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("classroom_pages", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.Column("page_type", sa.String(length=20), nullable=False, server_default="whiteboard"), sa.Column("image_url", sa.String(), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.UniqueConstraint("session_id", "position", name="uq_classroom_page_position"))
    op.create_index("idx_classroom_pages_session", "classroom_pages", ["session_id"])
    op.add_column("whiteboard_snapshots", sa.Column("page_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_whiteboard_snapshot_page", "whiteboard_snapshots", "classroom_pages", ["page_id"], ["id"], ondelete="CASCADE")
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT DISTINCT session_id,page_number FROM whiteboard_snapshots ORDER BY session_id,page_number")).mappings().all()
    for row in rows:
        pid = uuid.uuid4()
        latest = conn.execute(sa.text("SELECT image_url FROM whiteboard_snapshots WHERE session_id=:s AND page_number=:p ORDER BY created_at DESC LIMIT 1"), {"s": row["session_id"], "p": row["page_number"]}).scalar()
        conn.execute(sa.text("INSERT INTO classroom_pages(id,session_id,position,page_type,image_url) VALUES(:id,:s,:p,:t,:u)"), {"id": pid, "s": row["session_id"], "p": row["page_number"], "t": "pdf" if latest else "whiteboard", "u": latest})
        conn.execute(sa.text("UPDATE whiteboard_snapshots SET page_id=:id WHERE session_id=:s AND page_number=:p"), {"id": pid, "s": row["session_id"], "p": row["page_number"]})
    op.alter_column("whiteboard_snapshots", "page_id", nullable=False)

def downgrade():
    op.drop_constraint("fk_whiteboard_snapshot_page", "whiteboard_snapshots", type_="foreignkey")
    op.drop_column("whiteboard_snapshots", "page_id")
    op.drop_index("idx_classroom_pages_session", table_name="classroom_pages")
    op.drop_table("classroom_pages")
