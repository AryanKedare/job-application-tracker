-- Security hardening for existing installations.
-- Apply after supabase/setup.sql (or via Supabase CLI migrations).

begin;

-- -----------------------------------------------------------------------------
-- 1. Lifecycle history is append-only for application users
-- -----------------------------------------------------------------------------

-- These trigger functions must write history even though authenticated users can
-- no longer insert/update/delete application_stage_events directly.
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

revoke insert, update, delete on table public.application_stage_events from anon, authenticated;
grant select on table public.application_stage_events to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Private resume storage
-- -----------------------------------------------------------------------------

-- Convert legacy public URLs into bucket-relative object paths before the bucket
-- is made private. New application code stores paths directly.
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
