-- LEGACY UPGRADE MIGRATION
--
-- Fresh installations do NOT need this file. The current supabase/setup.sql
-- already includes these secure defaults.
--
-- This migration is retained for installations created from an older release
-- where lifecycle events were user-editable and the resumes bucket was public.
-- Apply it only when upgrading such an installation without re-running the
-- current canonical setup.sql.

begin;

-- -----------------------------------------------------------------------------
-- 1. Lifecycle history is append-only for application users
-- -----------------------------------------------------------------------------

alter function public.log_application_stage_event() security definer;
alter function public.log_application_stage_event() set search_path = public, pg_temp;
alter function public.log_application_status_event() security definer;
alter function public.log_application_status_event() set search_path = public, pg_temp;

-- Trigger functions are not application RPC endpoints.
revoke execute on function public.log_application_stage_event() from public, anon, authenticated;
revoke execute on function public.log_application_status_event() from public, anon, authenticated;

drop policy if exists "Users can create their lifecycle events" on public.application_stage_events;
drop policy if exists "Users can update their lifecycle events" on public.application_stage_events;
drop policy if exists "Users can delete their lifecycle events" on public.application_stage_events;

revoke insert, update, delete on table public.application_stage_events from public, anon, authenticated;
grant select on table public.application_stage_events to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Private resume storage
-- -----------------------------------------------------------------------------

-- Convert the legacy Supabase public URL format into bucket-relative object paths.
update public.job_applications
set resume_url = regexp_replace(
  resume_url,
  '^https?://[^/]+/storage/v1/object/public/resumes/',
  ''
)
where resume_url ~ '^https?://[^/]+/storage/v1/object/public/resumes/';

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf']::text[]
where id = 'resumes';

drop policy if exists "Users can read their resumes" on storage.objects;
create policy "Users can read their resumes"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
