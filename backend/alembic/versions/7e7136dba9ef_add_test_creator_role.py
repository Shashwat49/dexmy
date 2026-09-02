"""add test_creator role

Revision ID: 7e7136dba9ef
Revises: 6d6136dba9ef
Create Date: 2026-09-02 21:14:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7e7136dba9ef'
down_revision = '6d6136dba9ef'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use execute to alter the enum type directly in Postgres
    # Note: ADD VALUE cannot be executed inside a transaction block, 
    # but alembic usually wraps things in a transaction. 
    # Let's set autocommit block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'test_creator'")


def downgrade() -> None:
    # Postgres doesn't easily support dropping an enum value.
    pass
