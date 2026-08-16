-- Application lifecycle / interview round tracking.
-- Existing Bookmarked rows are preserved; only new application defaults change to Applied.

alter table public.job_applications
  alter column status set default 'Applied';

alter table public.job_applications
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_stage_name text;

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
create unique index if not exists application_stages_one_current_idx
  on public.application_stages(application_id)
  where state = 'current';

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

alter table public.application_stages enable row level security;
alter table public.application_stage_events enable row level security;

drop policy if exists "Users can read their application stages" on public.application_stages;
drop policy if exists "Users can create their application stages" on public.application_stages;
drop policy if exists "Users can update their application stages" on public.application_stages;
drop policy if exists "Users can delete their application stages" on public.application_stages;

create policy "Users can read their application stages"
  on public.application_stages for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.job_applications j
      where j.id = application_id and j.user_id = auth.uid()
    )
  );

create policy "Users can create their application stages"
  on public.application_stages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.job_applications j
      where j.id = application_id and j.user_id = auth.uid()
    )
  );

create policy "Users can update their application stages"
  on public.application_stages for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.job_applications j
      where j.id = application_id and j.user_id = auth.uid()
    )
  );

create policy "Users can delete their application stages"
  on public.application_stages for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their lifecycle events" on public.application_stage_events;
drop policy if exists "Users can create their lifecycle events" on public.application_stage_events;

create policy "Users can read their lifecycle events"
  on public.application_stage_events for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.job_applications j
      where j.id = application_id and j.user_id = auth.uid()
    )
  );

create policy "Users can create their lifecycle events"
  on public.application_stage_events for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.job_applications j
      where j.id = application_id and j.user_id = auth.uid()
    )
  );

create or replace function public.set_application_stage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists application_stage_updated_at on public.application_stages;
create trigger application_stage_updated_at
before update on public.application_stages
for each row execute function public.set_application_stage_updated_at();

create or replace function public.log_application_stage_event()
returns trigger
language plpgsql
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'stage_added';
  elsif old.name is distinct from new.name then
    insert into public.application_stage_events (
      application_id, stage_id, user_id, event_type, stage_name_snapshot, notes
    ) values (
      new.application_id, new.id, new.user_id, 'stage_renamed', new.name,
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
      application_id, stage_id, user_id, event_type, stage_name_snapshot
    ) values (
      new.application_id, new.id, new.user_id, v_event_type, new.name
    );
  end if;

  return new;
end;
$$;

drop trigger if exists application_stage_event_log on public.application_stages;
create trigger application_stage_event_log
after insert or update on public.application_stages
for each row execute function public.log_application_stage_event();

create or replace function public.sync_application_from_stage()
returns trigger
language plpgsql
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
        where id = new.application_id and user_id = new.user_id;
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
        where id = new.application_id and user_id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists application_stage_status_sync on public.application_stages;
create trigger application_stage_status_sync
after insert or update on public.application_stages
for each row execute function public.sync_application_from_stage();

create or replace function public.log_application_status_event()
returns trigger
language plpgsql
as $$
declare
  v_stage_id uuid;
  v_stage_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.application_stage_events (
      application_id, user_id, event_type, to_status, occurred_at
    ) values (
      new.id, new.user_id, 'application_created', new.status, coalesce(new.created_at, now())
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    select s.id, s.name
      into v_stage_id, v_stage_name
      from public.application_stages s
      where s.application_id = new.id
        and s.state in ('current', 'rejected')
      order by case when s.state = 'rejected' then 0 else 1 end, s.position desc
      limit 1;

    insert into public.application_stage_events (
      application_id, stage_id, user_id, event_type, stage_name_snapshot,
      from_status, to_status
    ) values (
      new.id, v_stage_id, new.user_id, 'status_changed', v_stage_name,
      old.status, new.status
    );
  end if;

  return new;
end;
$$;

drop trigger if exists application_status_event_log_insert on public.job_applications;
create trigger application_status_event_log_insert
after insert on public.job_applications
for each row execute function public.log_application_status_event();

drop trigger if exists application_status_event_log_update on public.job_applications;
create trigger application_status_event_log_update
after update of status on public.job_applications
for each row execute function public.log_application_status_event();

-- Give existing applications a lifecycle starting point without changing their status.
insert into public.application_stage_events (
  application_id, user_id, event_type, to_status, occurred_at, notes
)
select j.id, j.user_id, 'application_imported', j.status,
       coalesce(j.created_at, now()),
       'Existing application added to lifecycle history during migration.'
from public.job_applications j
where not exists (
  select 1 from public.application_stage_events e
  where e.application_id = j.id
);
