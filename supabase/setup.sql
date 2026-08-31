-- Job Application Tracker - canonical Supabase setup
--
-- Public-release setup: run this entire file in Supabase SQL Editor.
-- It is intentionally idempotent and is the only SQL file required for a fresh
-- installation. It can also be re-run on an existing installation to bring the
-- database, lifecycle history, and resume storage policies to the current secure
-- defaults.
--
-- Existing application rows are preserved. Existing Bookmarked applications are
-- not changed; only the default for NEW applications is Applied.

begin;

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 2. Job applications
-- -----------------------------------------------------------------------------

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_title text not null,
  company text,
  job_link text,
  status text not null default 'Applied'
    check (status in ('Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted')),
  date_applied date,
  location text,
  source text,
  resume_url text,
  jd_text text,
  notes text,
  rejected_at timestamptz,
  rejected_stage_name text,
  created_at timestamptz not null default now()
);

-- Upgrade older installations safely.
alter table public.job_applications
  add column if not exists jd_text text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_stage_name text;

alter table public.job_applications
  alter column status set default 'Applied';

create index if not exists job_applications_user_id_idx
  on public.job_applications(user_id);

create index if not exists job_applications_user_date_idx
  on public.job_applications(user_id, date_applied desc);

alter table public.job_applications enable row level security;

revoke all on table public.job_applications from anon;
grant select, insert, update, delete on table public.job_applications to authenticated;

drop policy if exists "Users can read their applications" on public.job_applications;
drop policy if exists "Users can create their applications" on public.job_applications;
drop policy if exists "Users can update their applications" on public.job_applications;
drop policy if exists "Users can delete their applications" on public.job_applications;

create policy "Users can read their applications"
  on public.job_applications
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their applications"
  on public.job_applications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their applications"
  on public.job_applications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their applications"
  on public.job_applications
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Convert the legacy public resume URL format into bucket-relative object paths.
-- New application code stores paths directly in the historical resume_url column.
update public.job_applications
set resume_url = regexp_replace(
  resume_url,
  '^https?://[^/]+/storage/v1/object/public/resumes/',
  ''
)
where resume_url ~ '^https?://[^/]+/storage/v1/object/public/resumes/';

-- -----------------------------------------------------------------------------
-- 3. Application stages / interview rounds
-- -----------------------------------------------------------------------------

create table if not exists public.application_stages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  stage_type text not null default 'custom' check (char_length(stage_type) between 1 and 80),
  position integer not null default 0 check (position >= 0),
  state text not null default 'pending'
    check (state in ('pending', 'current', 'completed', 'skipped', 'rejected')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_stages_application_position_idx
  on public.application_stages(application_id, position, created_at);

create index if not exists application_stages_user_idx
  on public.application_stages(user_id);

-- At most one round can be actively in progress for an application.
create unique index if not exists application_stages_one_current_idx
  on public.application_stages(application_id)
  where state = 'current';

alter table public.application_stages enable row level security;

revoke all on table public.application_stages from anon;
grant select, insert, update, delete on table public.application_stages to authenticated;

drop policy if exists "Users can read their application stages" on public.application_stages;
drop policy if exists "Users can create their application stages" on public.application_stages;
drop policy if exists "Users can update their application stages" on public.application_stages;
drop policy if exists "Users can delete their application stages" on public.application_stages;

create policy "Users can read their application stages"
  on public.application_stages
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.job_applications j
      where j.id = application_id
        and j.user_id = auth.uid()
    )
  );

create policy "Users can create their application stages"
  on public.application_stages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.job_applications j
      where j.id = application_id
        and j.user_id = auth.uid()
    )
  );

create policy "Users can update their application stages"
  on public.application_stages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.job_applications j
      where j.id = application_id
        and j.user_id = auth.uid()
    )
  );

create policy "Users can delete their application stages"
  on public.application_stages
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.job_applications j
      where j.id = application_id
        and j.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Append-only lifecycle history
-- -----------------------------------------------------------------------------

create table if not exists public.application_stage_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications(id) on delete cascade,
  stage_id uuid references public.application_stages(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  stage_name_snapshot text,
  from_status text,
  to_status text,
  notes text,
  occurred_at timestamptz not null default now()
);

create index if not exists application_stage_events_application_time_idx
  on public.application_stage_events(application_id, occurred_at desc);

create index if not exists application_stage_events_user_idx
  on public.application_stage_events(user_id);

alter table public.application_stage_events enable row level security;

-- Lifecycle history is generated by trigger functions. Normal application users
-- may read their own history but cannot insert, rewrite, or delete event rows.
revoke insert, update, delete on table public.application_stage_events from public, anon, authenticated;
grant select on table public.application_stage_events to authenticated;

drop policy if exists "Users can read their lifecycle events" on public.application_stage_events;
drop policy if exists "Users can create their lifecycle events" on public.application_stage_events;
drop policy if exists "Users can update their lifecycle events" on public.application_stage_events;
drop policy if exists "Users can delete their lifecycle events" on public.application_stage_events;

create policy "Users can read their lifecycle events"
  on public.application_stage_events
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.job_applications j
      where j.id = application_id
        and j.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Lifecycle trigger functions
-- -----------------------------------------------------------------------------

create or replace function public.set_application_stage_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists application_stage_updated_at on public.application_stages;
create trigger application_stage_updated_at
before update on public.application_stages
for each row
execute function public.set_application_stage_updated_at();

create or replace function public.log_application_stage_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'stage_added';
  elsif old.name is distinct from new.name then
    insert into public.application_stage_events (
      application_id,
      stage_id,
      user_id,
      event_type,
      stage_name_snapshot,
      notes
    ) values (
      new.application_id,
      new.id,
      new.user_id,
      'stage_renamed',
      new.name,
      'Renamed from "' || old.name || '"'
    );
  end if;

  if tg_op = 'UPDATE' and old.state is distinct from new.state then
    v_event_type := case new.state
      when 'current' then 'stage_started'
      when 'completed' then 'stage_completed'
      when 'skipped' then 'stage_skipped'
      when 'rejected' then 'stage_rejected'
      else 'stage_reset'
    end;
  end if;

  if v_event_type is not null then
    insert into public.application_stage_events (
      application_id,
      stage_id,
      user_id,
      event_type,
      stage_name_snapshot
    ) values (
      new.application_id,
      new.id,
      new.user_id,
      v_event_type,
      new.name
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.log_application_stage_event() from public, anon, authenticated;

drop trigger if exists application_stage_event_log on public.application_stages;
create trigger application_stage_event_log
after insert or update on public.application_stages
for each row
execute function public.log_application_stage_event();

create or replace function public.sync_application_from_stage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.state = 'current' then
      update public.job_applications
      set status = 'Interviewing'
      where id = new.application_id
        and user_id = new.user_id
        and status not in ('Offer', 'Rejected', 'Ghosted');
    elsif new.state = 'rejected' then
      update public.job_applications
      set status = 'Rejected',
          rejected_at = coalesce(new.completed_at, now()),
          rejected_stage_name = new.name
      where id = new.application_id
        and user_id = new.user_id;
    end if;
  elsif old.state is distinct from new.state then
    if new.state = 'current' then
      update public.job_applications
      set status = 'Interviewing'
      where id = new.application_id
        and user_id = new.user_id
        and status not in ('Offer', 'Rejected', 'Ghosted');
    elsif new.state = 'rejected' then
      update public.job_applications
      set status = 'Rejected',
          rejected_at = coalesce(new.completed_at, now()),
          rejected_stage_name = new.name
      where id = new.application_id
        and user_id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists application_stage_status_sync on public.application_stages;
create trigger application_stage_status_sync
after insert or update on public.application_stages
for each row
execute function public.sync_application_from_stage();

create or replace function public.log_application_status_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage_id uuid;
  v_stage_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.application_stage_events (
      application_id,
      user_id,
      event_type,
      to_status,
      occurred_at
    ) values (
      new.id,
      new.user_id,
      'application_created',
      new.status,
      coalesce(new.created_at, now())
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    select s.id, s.name
    into v_stage_id, v_stage_name
    from public.application_stages s
    where s.application_id = new.id
      and s.state in ('current', 'rejected')
    order by
      case when s.state = 'rejected' then 0 else 1 end,
      s.position desc
    limit 1;

    insert into public.application_stage_events (
      application_id,
      stage_id,
      user_id,
      event_type,
      stage_name_snapshot,
      from_status,
      to_status
    ) values (
      new.id,
      v_stage_id,
      new.user_id,
      'status_changed',
      v_stage_name,
      old.status,
      new.status
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.log_application_status_event() from public, anon, authenticated;

drop trigger if exists application_status_event_log_insert on public.job_applications;
create trigger application_status_event_log_insert
after insert on public.job_applications
for each row
execute function public.log_application_status_event();

drop trigger if exists application_status_event_log_update on public.job_applications;
create trigger application_status_event_log_update
after update of status on public.job_applications
for each row
execute function public.log_application_status_event();

-- Existing applications receive a single starting history record without changing
-- their application status. This is a no-op for applications already in history.
insert into public.application_stage_events (
  application_id,
  user_id,
  event_type,
  to_status,
  occurred_at,
  notes
)
select
  j.id,
  j.user_id,
  'application_imported',
  j.status,
  coalesce(j.created_at, now()),
  'Existing application added to lifecycle history during database setup.'
from public.job_applications j
where not exists (
  select 1
  from public.application_stage_events e
  where e.application_id = j.id
);

-- -----------------------------------------------------------------------------
-- 6. Single-use invite codes
-- -----------------------------------------------------------------------------

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_expires_at_idx
  on public.invite_codes(expires_at);

create index if not exists invite_codes_used_at_idx
  on public.invite_codes(used_at);

alter table public.invite_codes enable row level security;

-- Invite codes are server-only. Browser roles must never access this table.
revoke all on table public.invite_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.invite_codes to service_role;

-- -----------------------------------------------------------------------------
-- 7. Private resume storage bucket
-- -----------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

-- Remove legacy resume SELECT policies before installing the canonical owner-only
-- read policy. This also removes the previous public-release migration policy when
-- the setup file is re-run.
do $$
declare
  resume_select_policy record;
begin
  for resume_select_policy in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'SELECT'
      and (
        policyname ilike '%resume%'
        or coalesce(qual, '') ilike '%resumes%'
      )
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      resume_select_policy.policyname
    );
  end loop;
end;
$$;

drop policy if exists "Users can upload their resumes" on storage.objects;
drop policy if exists "Users can update their resumes" on storage.objects;
drop policy if exists "Users can delete their resumes" on storage.objects;

create policy "Users can read their resumes"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload their resumes"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their resumes"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their resumes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- Setup complete.
-- Supabase/PostgREST may take a few seconds to expose newly-created tables/policies.