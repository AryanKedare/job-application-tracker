# Installation and Database Setup

This project uses Supabase for PostgreSQL, authentication, and resume storage.

The repository intentionally keeps **all SQL required by the application in one canonical file**:

```text
supabase/setup.sql
```

Do not copy older SQL snippets from issues, commits, or previous README versions. For a new deployment, use the complete `supabase/setup.sql` file.

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

Copy and run the entire contents of:

```text
supabase/setup.sql
```

The script configures everything the database/storage side of the application needs:

- `public.job_applications`
- `public.application_stages`
- `public.application_stage_events`
- indexes
- application Row-Level Security policies
- stage Row-Level Security policies
- lifecycle history policies
- lifecycle trigger functions
- application/status event logging
- interview-stage status synchronisation
- `resumes` storage bucket
- 5 MB PDF restriction for the resume bucket
- per-user resume upload/update/delete policies

After the query succeeds, Supabase/PostgREST may take a few seconds to expose newly-created tables.

### 3. Verify the schema

In **Table Editor**, confirm these tables exist:

```text
job_applications
application_stages
application_stage_events
```

In **Storage**, confirm this bucket exists:

```text
resumes
```

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

# Optional logo provider
LOGO_DEV_PUBLISHABLE_KEY=your-logo-dev-publishable-key
```

Never prefix these with `NEXT_PUBLIC_`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `GROQ_API_KEY`

## Upgrading an existing installation

`supabase/setup.sql` is also the canonical upgrade path for installations created before lifecycle/interview-stage tracking was added.

Before changing a production database, take a backup according to your normal operational process.

Then run the **current complete** `supabase/setup.sql` in the SQL Editor.

The setup script is designed to be re-runnable. For older databases it will:

- preserve all existing `job_applications` rows
- preserve existing `Bookmarked` applications
- change the default for **new** applications from `Bookmarked` to `Applied`
- add `jd_text` if missing
- add `rejected_at` if missing
- add `rejected_stage_name` if missing
- create `application_stages` if missing
- create `application_stage_events` if missing
- recreate the required RLS policies
- create/update lifecycle triggers
- ensure the `resumes` bucket and storage policies are configured
- create one `application_imported` lifecycle event for older applications that have no lifecycle history yet

It does **not** automatically turn existing bookmarked jobs into applied jobs.

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

Normal authenticated users can read and append appropriate history through application operations, but no update/delete RLS policies are exposed for event rows. This prevents ordinary user operations from rewriting lifecycle history.

## Resume storage

The setup file creates/configures the `resumes` bucket with:

- public access, because the current application stores public resume URLs
- 5 MB file limit
- `application/pdf` MIME restriction
- user-specific object paths such as `resumes/<user-id>/...`

For higher-sensitivity deployments, migrate the application to a private bucket and signed URLs before making the bucket private.

## Re-running `setup.sql`

The SQL file uses idempotent patterns wherever practical, including:

- `create ... if not exists`
- `add column if not exists`
- `create or replace function`
- dropping/recreating named policies and triggers
- `on conflict` for the resume bucket
- guarded import of lifecycle history

This makes one file useful for both initial setup and bringing an older installation up to the current schema.

## Troubleshooting

### Stage tracking reports missing tables

Run the current `supabase/setup.sql`, confirm it completes successfully, wait a few seconds for the schema cache, and refresh the app.

### Permission denied / RLS error

Re-run `supabase/setup.sql` and verify the authenticated user owns the application row (`user_id`).

### Resume uploads fail

Check that:

- the `resumes` bucket exists
- the user is authenticated
- the object path begins with the user's ID
- the file is a PDF
- the file is no larger than 5 MB

### Existing jobs disappeared after upgrade

The provided setup script does not delete job application rows. Stop changes and inspect the database/audit logs before running unrelated cleanup queries.
