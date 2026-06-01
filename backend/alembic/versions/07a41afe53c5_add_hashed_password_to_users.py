"""add_hashed_password_to_users

Revision ID: 07a41afe53c5
Revises: 9bf1764ddab0
Create Date: 2026-05-26 21:39:56.940515

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '07a41afe53c5'
down_revision: Union[str, None] = '9bf1764ddab0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
