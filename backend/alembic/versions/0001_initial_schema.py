"""Initial schema for KodomoTracker

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users (家族・関係者アカウント)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "relationship",
            sa.Enum(
                "father",
                "mother",
                "grandfather",
                "grandmother",
                "babysitter",
                "other",
                name="relationship_type_enum",
            ),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.Enum("admin", "editor", "viewer", name="user_role_enum"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. children (子ども情報)
    op.create_table(
        "children",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "gender",
            sa.Enum("male", "female", "unspecified", name="gender_enum"),
            nullable=False,
        ),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # 3. nursery_menus (保育園・学校献立データ)
    op.create_table(
        "nursery_menus",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column(
            "menu_details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_nursery_menus_target_date"),
        "nursery_menus",
        ["target_date"],
        unique=False,
    )

    # 4. records (統合成長・生活ログ)
    op.create_table(
        "records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recorded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "category",
            sa.Enum(
                "milk",
                "baby_food",
                "meal",
                "sleep",
                "excretion",
                "body_temp",
                "height",
                "weight",
                "head_circumference",
                "chest_circumference",
                "foot_size",
                "custom",
                name="record_category_enum",
            ),
            nullable=False,
        ),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["child_id"], ["children.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_records_category"), "records", ["category"], unique=False
    )
    op.create_index(
        op.f("ix_records_child_id"), "records", ["child_id"], unique=False
    )
    op.create_index(
        op.f("ix_records_recorded_by"), "records", ["recorded_by"], unique=False
    )
    op.create_index(
        op.f("ix_records_start_time"), "records", ["start_time"], unique=False
    )

    # 5. prescriptions (処方箋・服薬マスタ)
    op.create_table(
        "prescriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("medicine_name", sa.String(length=255), nullable=False),
        sa.Column("dosage_per_time", sa.Float(), nullable=False),
        sa.Column(
            "frequency_type",
            sa.Enum(
                "after_meal",
                "interval_hours",
                "specific_time",
                name="frequency_type_enum",
            ),
            nullable=False,
        ),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ["child_id"], ["children.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_prescriptions_child_id"),
        "prescriptions",
        ["child_id"],
        unique=False,
    )

    # 6. camera_events (エッジAIからの受信ログ)
    op.create_table(
        "camera_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum(
                "sleep_start",
                "sleep_end",
                "rollover",
                name="camera_event_type_enum",
            ),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["child_id"], ["children.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_camera_events_child_id"),
        "camera_events",
        ["child_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_camera_events_detected_at"),
        "camera_events",
        ["detected_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_camera_events_detected_at"), table_name="camera_events"
    )
    op.drop_index(op.f("ix_camera_events_child_id"), table_name="camera_events")
    op.drop_table("camera_events")

    op.drop_index(op.f("ix_prescriptions_child_id"), table_name="prescriptions")
    op.drop_table("prescriptions")

    op.drop_index(op.f("ix_records_start_time"), table_name="records")
    op.drop_index(op.f("ix_records_recorded_by"), table_name="records")
    op.drop_index(op.f("ix_records_child_id"), table_name="records")
    op.drop_index(op.f("ix_records_category"), table_name="records")
    op.drop_table("records")

    op.drop_index(
        op.f("ix_nursery_menus_target_date"), table_name="nursery_menus"
    )
    op.drop_table("nursery_menus")

    op.drop_table("children")
    op.drop_table("users")

    sa.Enum(name="camera_event_type_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="frequency_type_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="record_category_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="gender_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="relationship_type_enum").drop(op.get_bind(), checkfirst=True)
