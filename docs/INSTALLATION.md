# Installation and Database Setup

This project uses Supabase for PostgreSQL, authentication, and private resume storage.

Database installation has two ordered steps:

```text
supabase/setup.sql
supabase/migrations/20260831_security_hardening.sql
```

Do not copy older SQL snippets from issues, commits, or previous README versions.

## Fresh installation

### 1. Create the Supabase project

Create a new Supabase project and wait until the database is ready.

From **Project Settings → API**, record:

- Project URL
- anon/public key
- service-role key

The service-role key is server-only and must never be exposed to browser code.

### 2. Run the complete SQL setup

Open **Supabase → SQL Editor** and create a new query.

First, copy and run the entire contents of:

```text
supabase/setup.sql
```

Then copy and run:

```text
supabase/migrations/20260831_security_hardening.sql
```

The base setup configures:

- `public.job_applications`
- `public.application_stages`
- `public.application_stage_events`
- indexes
- application Row-Level Security policies
- stage Row-Level Security policies
- lifecycle trigger functions
- application/status event logging
- interview-stage status synchronisation
- `resumes` storage bucket
- 5 MB PDF restriction for the resume bucket
- per-user resume upload/update/delete policies

The security migration then:

- migrates known legacy public resume URLs to bucket-relative paths
- makes the `resumes` bucket private
- adds per-user SELECT access required for signed resume URLs
- converts lifecycle history to trigger-written, read-only data for normal users

After the queries succeed, Supabase/PostgREST may take a few seconds to expose newly-created tables and policies.

### 3. Verify the schema

In **Table Editor**, confirm these tables exist:

```text
job_applications
application_stages
application_stage_events
```

In **Storage**, confirm the `resumes` bucket exists and is **private**.

### 4. Configure authentication URLs

For local development, set:

```text
Site URL: http://localhost:3000
```

Add redirect URLs:

```text
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/reset-password**
```

For production, replace `http://localhost:3000` with the deployed domain.

### 5. Configure email templates

Use Supabase's generated confirmation URL in password-reset, invitation, and magic-link emails.

For password recovery:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

Do not hardcode the site URL into the reset link.

### 6. Configure environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters

# Optional AI import
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
```

Never prefix these with `NEXT_PUBLIC_`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `GROQ_API_KEY`

## Upgrading an existing installation

Before changing a production database, take a backup according to your normal operational process.

Run these files in order:

```text
supabase/setup.sql
supabase/migrations/20260831_security_hardening.sql
```

The setup script is designed to be re-runnable. For older databases it will:

- preserve all existing `job_applications` rows
- preserve existing `Bookmarked` applications
- change the default for **new** applications from `Bookmarked` to `Applied`
- add `jd_text` if missing
- add `rejected_at` if missing
- add `rejected_stage_name` if missing
- create `application_stages` if missing
- create `application_stage_events` if missing
- recreate the base RLS policies
- create/update lifecycle triggers
- ensure the `resumes` bucket and storage policies are configured
- create one `application_imported` lifecycle event for older applications that have no lifecycle history yet

The security migration then applies the current private-storage and append-only-history model. It does **not** delete application rows or turn existing bookmarked jobs into applied jobs.

## Lifecycle data model

### `job_applications`

Stores the high-level application state and job details.

Typical statuses:

```text
Bookmarked
Applied
Interviewing
Offer
Rejected
Ghosted
```

### `application_stages`

Stores the ordered interview/assessment pipeline for one application.

Examples:

```text
Recruiter Screening
Coding Assessment
Technical Interview - Round 1
Technical Interview - Round 2
Final Interview
```

Stage states are:

```text
pending
current
completed
skipped
rejected
```

A partial unique index ensures an application has at most one `current` stage.

### `application_stage_events`

Stores lifecycle history and stage-name snapshots.

Examples:

```text
application_created
application_imported
stage_added
stage_started
stage_completed
stage_skipped
stage_rejected
stage_renamed
status_changed
```

Normal authenticated users can read lifecycle history but cannot insert, update, or delete event rows directly. Security-definer trigger functions append history as application and stage operations occur.

## Resume storage

After the security migration, the `resumes` bucket has:

- private access
- 5 MB file limit
- `application/pdf` MIME restriction
- user-specific object paths such as `<user-id>/<uuid>.pdf`
- authenticated SELECT/INSERT/UPDATE/DELETE policies restricted to the user's own top-level folder

`job_applications.resume_url` stores the bucket-relative object path for new uploads. The migration converts the previous Supabase public URL format when it recognizes it. The UI creates a short-lived signed URL only when the authenticated owner opens a resume.

## Re-running the SQL

`supabase/setup.sql` uses idempotent patterns wherever practical, including:

- `create ... if not exists`
- `add column if not exists`
- `create or replace function`
- dropping/recreating named policies and triggers
- `on conflict` for the resume bucket
- guarded import of lifecycle history

After re-running `setup.sql`, re-run `supabase/migrations/20260831_security_hardening.sql` so the security overrides remain the final state.

## Troubleshooting

### Stage tracking reports missing tables

Run both SQL files in order, confirm they complete successfully, wait a few seconds for the schema cache, and refresh the app.

### Permission denied / RLS error

Re-run both SQL files and verify the authenticated user owns the application row (`user_id`).

### Resume uploads or downloads fail

Check that:

- the `resumes` bucket exists and is private
- the security migration has been applied
- the user is authenticated
- the object path begins with the user's ID
- the user has the per-folder storage SELECT policy
- the file is a PDF
- the file is no larger than 5 MB

### Existing jobs disappeared after upgrade

The provided SQL does not delete job application rows. Stop changes and inspect the database/audit logs before running unrelated cleanup queries.
