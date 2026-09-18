-- External Google Meet class tracking.
-- Dexmy stores the academic record and package balance; the actual meeting remains on Google Meet.

create table if not exists public.external_class_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete restrict,
  teacher_id uuid not null references public.users(id) on delete restrict,
  student_package_id uuid not null references public.student_packages(id) on delete restrict,
  subject text not null,
  topic text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'completed' check (status in ('completed','cancelled','no_show')),
  teacher_notes text,
  homework text,
  google_meet_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_class_records_time_check check (ended_at > started_at),
  constraint external_class_records_duration_check check (duration_minutes = greatest(1, ceil(extract(epoch from (ended_at - started_at)) / 60.0)::integer))
);

create index if not exists external_class_records_student_idx on public.external_class_records(student_id, started_at desc);
create index if not exists external_class_records_teacher_idx on public.external_class_records(teacher_id, started_at desc);
create index if not exists external_class_records_package_idx on public.external_class_records(student_package_id, started_at desc);

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
    if old_completed then
      update public.student_packages set classes_used = greatest(0, classes_used - 1) where id = old.student_package_id;
    end if;
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

drop trigger if exists external_class_records_package_usage on public.external_class_records;
create trigger external_class_records_package_usage
after insert or update of status,student_package_id or delete on public.external_class_records
for each row execute function public.sync_external_class_package_usage();

alter table public.external_class_records enable row level security;
drop policy if exists external_class_records_teacher_select on public.external_class_records;
drop policy if exists external_class_records_student_select on public.external_class_records;
drop policy if exists external_class_records_teacher_insert on public.external_class_records;
create policy external_class_records_teacher_select on public.external_class_records for select using (teacher_id = auth.uid());
create policy external_class_records_student_select on public.external_class_records for select using (student_id = auth.uid());
create policy external_class_records_teacher_insert on public.external_class_records for insert with check (teacher_id = auth.uid());

-- Seed the two externally-taught students with an active 25-class allocation.
insert into public.student_packages (student_id, package_plan_id, total_classes, classes_used, status, purchased_at)
select u.id, pp.id, 25, 0, 'active', now()
from public.users u
cross join lateral (
  select id from public.package_plans
  where class_count = 25 and currency = 'INR' and is_active = true
  order by created_at asc limit 1
) pp
where lower(u.email) in ('ashvithgade@gmail.com','rshouryagade@gmail.com')
and not exists (
  select 1 from public.student_packages sp
  where sp.student_id = u.id and sp.total_classes = 25 and sp.status = 'active'
);
