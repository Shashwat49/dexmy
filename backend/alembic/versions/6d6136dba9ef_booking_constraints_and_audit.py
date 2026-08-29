"""booking_constraints_and_audit

Revision ID: 6d6136dba9ef
Revises: 
Create Date: 2026-08-29 12:56:17.346262

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d6136dba9ef'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create btree_gist extension (needed for EXCLUDE constraints on timestamp ranges)
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")

    # 2. Add idempotency_key to bookings
    op.add_column('bookings', sa.Column('idempotency_key', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_bookings_idempotency_key'), 'bookings', ['idempotency_key'], unique=True)

    # 3. Create booking_assignment_audits table
    op.create_table('booking_assignment_audits',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('booking_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('admin_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prev_teacher', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('new_teacher', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['new_teacher'], ['teacher_profiles.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['prev_teacher'], ['teacher_profiles.user_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_booking_assignment_audits_admin_id'), 'booking_assignment_audits', ['admin_id'], unique=False)
    op.create_index(op.f('ix_booking_assignment_audits_booking_id'), 'booking_assignment_audits', ['booking_id'], unique=False)

    # 4. Enforce teacher_assignment_status CHECK constraint
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT chk_teacher_assignment_status
        CHECK (teacher_assignment_status IN ('pending', 'assigned', 'failed'));
    """)

    # 5. Fix duration_minutes default
    op.execute("ALTER TABLE bookings ALTER COLUMN duration_minutes SET DEFAULT 55;")

    # 6. Student Exclusion Constraint
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT no_student_double_booking
        EXCLUDE USING GIST (
            student_id WITH =,
            tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
        )
        WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
    """)

    # 7. Teacher Exclusion Constraint
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT no_teacher_double_booking
        EXCLUDE USING GIST (
            teacher_id WITH =,
            tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
        )
        WHERE (teacher_id IS NOT NULL AND status NOT IN ('cancelled', 'completed', 'no_show'));
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_teacher_double_booking;")
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_student_double_booking;")
    op.execute("ALTER TABLE bookings ALTER COLUMN duration_minutes SET DEFAULT 60;")
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_teacher_assignment_status;")
    
    op.drop_index(op.f('ix_booking_assignment_audits_booking_id'), table_name='booking_assignment_audits')
    op.drop_index(op.f('ix_booking_assignment_audits_admin_id'), table_name='booking_assignment_audits')
    op.drop_table('booking_assignment_audits')
    
    op.drop_index(op.f('ix_bookings_idempotency_key'), table_name='bookings')
    op.drop_column('bookings', 'idempotency_key')
    
    op.execute("DROP EXTENSION IF EXISTS btree_gist;")
