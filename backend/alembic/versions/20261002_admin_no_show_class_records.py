"""Add admin no-show attribution and consume student package classes for no-shows.

Revision ID: 20261002_admin_no_show_class_records
Revises: 20260909_student_account_details
"""
from alembic import op
import sqlalchemy as sa


revision = "20261002_admin_no_show_class_records"
down_revision = "20260909_student_account_details"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "external_class_records",
        sa.Column("created_by_admin_id", sa.UUID(), nullable=True),
    )
    op.create_index(
        "ix_external_class_records_created_by_admin_id",
        "external_class_records",
        ["created_by_admin_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_external_class_records_created_by_admin_id",
        "external_class_records",
        "users",
        ["created_by_admin_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute("""
    create or replace function public.sync_external_class_package_usage() returns trigger language plpgsql as $$
    declare
      old_consumed boolean := false;
      new_consumed boolean := false;
      delta integer := 0;
      target_package uuid;
      used_count integer;
      total_count integer;
    begin
      if tg_op <> 'INSERT' then old_consumed := old.status in ('completed','no_show'); end if;
      if tg_op <> 'DELETE' then new_consumed := new.status in ('completed','no_show'); end if;

      if tg_op = 'INSERT' then
        target_package := new.student_package_id;
      elsif tg_op = 'DELETE' then
        target_package := old.student_package_id;
      elsif old.student_package_id is distinct from new.student_package_id and (old_consumed or new_consumed) then
        if old_consumed then
          update public.student_packages set classes_used = greatest(0, classes_used - 1) where id = old.student_package_id;
        end if;
        if new_consumed then
          select classes_used, total_classes into used_count, total_count from public.student_packages where id = new.student_package_id for update;
          if used_count >= total_count then raise exception 'No remaining classes in this package'; end if;
          update public.student_packages set classes_used = classes_used + 1 where id = new.student_package_id;
        end if;
        return new;
      else
        target_package := new.student_package_id;
      end if;

      delta := case when new_consumed and not old_consumed then 1 when old_consumed and not new_consumed then -1 else 0 end;
      if delta = 1 then
        select classes_used, total_classes into used_count, total_count from public.student_packages where id = target_package for update;
        if used_count >= total_count then raise exception 'No remaining classes in this package'; end if;
        update public.student_packages set classes_used = classes_used + 1 where id = target_package;
      elsif delta = -1 then
        update public.student_packages set classes_used = greatest(0, classes_used - 1) where id = target_package;
      end if;

      if tg_op = 'DELETE' then return old; end if;
      return new;
    end; $$;
    """)


def downgrade():
    op.execute("""
    create or replace function public.sync_external_class_package_usage() returns trigger language plpgsql as $$
    declare
      old_completed boolean := false;
      new_completed boolean := false;
      delta integer := 0;
      target_package uuid;
      used_count integer;
      total_count integer;
    begin
      if tg_op <> 'INSERT' then old_completed := old.status = 'completed'; end if;
      if tg_op <> 'DELETE' then new_completed := new.status = 'completed'; end if;
      if tg_op = 'INSERT' then
        target_package := new.student_package_id;
      elsif tg_op = 'DELETE' then
        target_package := old.student_package_id;
      elsif old.student_package_id is distinct from new.student_package_id and (old_completed or new_completed) then
        if old_completed then update public.student_packages set classes_used = greatest(0, classes_used - 1) where id = old.student_package_id; end if;
        if new_completed then
          select classes_used, total_classes into used_count, total_count from public.student_packages where id = new.student_package_id for update;
          if used_count >= total_count then raise exception 'No remaining classes in this package'; end if;
          update public.student_packages set classes_used = classes_used + 1 where id = new.student_package_id;
        end if;
        return new;
      else
        target_package := new.student_package_id;
      end if;
      delta := case when new_completed and not old_completed then 1 when old_completed and not new_completed then -1 else 0 end;
      if delta = 1 then
        select classes_used, total_classes into used_count, total_count from public.student_packages where id = target_package for update;
        if used_count >= total_count then raise exception 'No remaining classes in this package'; end if;
        update public.student_packages set classes_used = classes_used + 1 where id = target_package;
      elsif delta = -1 then
        update public.student_packages set classes_used = greatest(0, classes_used - 1) where id = target_package;
      end if;
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end; $$;
    """)
    op.drop_constraint("fk_external_class_records_created_by_admin_id", "external_class_records", type_="foreignkey")
    op.drop_index("ix_external_class_records_created_by_admin_id", table_name="external_class_records")
    op.drop_column("external_class_records", "created_by_admin_id")
