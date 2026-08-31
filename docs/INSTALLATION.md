# Installation and Database Setup

This project uses Supabase for PostgreSQL, authentication, and private resume storage.

For a fresh installation, there is one canonical database/storage setup file:

```text
supabase/setup.sql
```

Do not assemble a new installation from SQL snippets in issues, old commits, or historical documentation.

## Fresh installation

### 1. Create a Supabase project

Create a new Supabase project and wait for the database to become available.

From the Supabase project settings, record:

- Project URL
- anon/public key
- service-role key

The service-role key bypasses Row-Level Security and must remain server-side.

### 2. Run `supabase/setup.sql`

Open **Supabase → SQL Editor**, create a new query, paste the complete contents of:

```text
supabase/setup.sql
```

Run the query once.

The setup file creates/configures:

- `public.job_applications`
- `public.application_stages`
- `public.application_stage_events`
- `public.invite_codes`
- indexes and constraints
- application/stage Row-Level Security
- append-only lifecycle history
- lifecycle/status trigger functions
- the private `resumes` Storage bucket
- 5 MB PDF-only resume restrictions
- owner-scoped resume SELECT/INSERT/UPDATE/DELETE policies
- conversion of recognized legacy public resume URLs into bucket-relative paths

The file is intentionally re-runnable and is also the preferred upgrade path for existing installations.

### 3. Verify the secure database state

In **Table Editor**, confirm these tables exist:

```text
job_applications
application_stages
application_stage_events
invite_codes
```

In **Storage**, confirm:

```text
Bucket: resumes
Public: false
File size limit: 5 MB
Allowed MIME type: application/pdf
```

The expected application security model is:

- authenticated users can access only their own `job_applications`
- authenticated users can access stages only for their own applications
- authenticated users can read their lifecycle history but cannot directly insert/update/delete event rows
- invite-code storage is server/service-role only
- authenticated users can access resume objects only when the top-level storage folder equals their Supabase user ID

Supabase/PostgREST may take a few seconds to refresh its schema cache after setup.

### 4. Configure authentication URLs

For local development:

```text
Site URL: http://localhost:3000
```

Add redirect URLs such as:

```text
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/reset-password**
```

For production, use the deployed HTTPS origin instead of `localhost` and remove development-only origins you do not need.

### 5. Configure authentication email templates

Password recovery, invitation, and magic-link emails should use Supabase-generated confirmation URLs rather than a hard-coded application URL.

For password recovery, for example:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

After changing authentication URL/template settings, generate a new email before testing again because previously generated links retain their old destination.

### 6. Configure environment variables

Copy the committed example file:

```bash
cp .env.example .env.local
```

Then replace every placeholder.

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

Optional access-request contact:

```env
NEXT_PUBLIC_ACCESS_REQUEST_EMAIL=
```

If `NEXT_PUBLIC_ACCESS_REQUEST_EMAIL` is set, the login page shows **Request access by email** and uses that value as the `mailto:` recipient. If it is unset or blank, the link is hidden. Keep deployment-specific contact values in the deployment environment rather than committing them to the repository.

Other optional variables:

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
MAINTENANCE_MODE=false
```

Never use a `NEXT_PUBLIC_` prefix for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `GROQ_API_KEY`

Generate a strong admin session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 7. Install and run the app

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/admin
```

Sign in to `/admin` using the configured admin credentials and invite the first application user.

If access requests are enabled, test **Request access by email** on `/login`. It should open the device's email handler with the recipient, subject, and access-request body pre-filled. The requester still presses **Send** in their mail client; the application does not send mail directly.

## Database model

### `job_applications`

Stores the high-level application state and job details.

Supported status values are:

```text
Bookmarked
Applied
Interviewing
Offer
Rejected
Ghosted
```

New rows default to `Applied`. Re-running setup does not convert existing `Bookmarked` rows.

### `application_stages`

Stores the ordered interview/assessment pipeline for an application.

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

Stores lifecycle history and stage-name snapshots, including events such as:

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

Normal authenticated users receive SELECT access to their own event rows only. Logging trigger functions run as `SECURITY DEFINER` with an explicit `public, pg_temp` search path so the application can append history without granting users direct history-table write privileges.

### `invite_codes`

Stores SHA-256 invite-code hashes, expiry timestamps, and one-time-use state. Browser roles have no direct access; the server-side service-role client performs invite-code operations.

## Resume storage

The `resumes` bucket is private and accepts PDF files up to 5 MB.

Objects are stored under paths such as:

```text
<user-id>/<uuid>.pdf
```

The historical `job_applications.resume_url` column stores that bucket-relative object path for new uploads. The client creates a short-lived signed URL when the authenticated owner opens a resume.

The setup file recognizes the previous Supabase public-object URL form and converts it to the object path when upgrading an older installation.

## Upgrading an existing installation

Before changing a production database, take a backup according to your normal operational process.

The preferred upgrade path is to run the current complete:

```text
supabase/setup.sql
```

It is designed to preserve existing application rows while bringing the schema and policies to the current state. Depending on the age of the installation, it can:

- add missing lifecycle/rejection columns
- create lifecycle tables and indexes
- recreate the current RLS policies
- recreate lifecycle/status triggers
- import one starting lifecycle event for applications with no history
- convert recognized legacy public resume URLs to object paths
- enforce private resume storage and owner-only policies

It does **not** deliberately delete application rows or turn existing bookmarked roles into applied applications.

### Legacy hardening migration

`supabase/migrations/20260831_security_hardening.sql` is retained for deployments created from an older release.

Fresh installations do not need it. Use it only if you intentionally want to apply the original privacy/history hardening without re-running the current canonical `setup.sql`.

## Production deployment verification

Before opening the instance to users:

1. Run `npm run lint`.
2. Run `npm run build`.
3. Confirm production environment variables contain no development credentials.
4. Confirm Supabase auth redirects reference the production HTTPS origin.
5. If access requests are enabled, confirm `NEXT_PUBLIC_ACCESS_REQUEST_EMAIL` is set only in the deployment environment and test the mailto flow.
6. Confirm the `resumes` bucket is private.
7. Upload a resume as one user and verify another user cannot access its object path.
8. Verify lifecycle history can be read but not directly edited through the authenticated client.
9. Test invitation, password recovery, and magic-link flows.
10. Test account/data deletion, including resume object removal.
11. Back up the database before future schema upgrades.

For additional release checks, see [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md).

## Troubleshooting

### Stage tracking reports missing tables

Run the current complete `supabase/setup.sql`, wait a few seconds for the Supabase schema cache to refresh, then reload the application.

### Permission denied / RLS error

Confirm the authenticated user's `auth.uid()` matches the relevant `user_id`, and re-run the current setup file to recreate the canonical policies.

### Resume upload fails

Check that:

- the `resumes` bucket exists and is private
- the user is authenticated
- the object path begins with the authenticated user's ID
- the file is a PDF
- the file is no larger than 5 MB

### Resume download fails

Check the owner-only Storage SELECT policy and confirm the database contains a bucket-relative object path rather than a stale external/public URL.

### Request access does not appear or open a draft

Confirm `NEXT_PUBLIC_ACCESS_REQUEST_EMAIL` is set in the deployment environment and that the device/browser has a default handler configured for `mailto:` links. The application prepares the draft but does not send email automatically.

### Existing jobs disappeared after an upgrade

The provided setup does not intentionally delete job application rows. Stop further changes and inspect the database/audit logs and backups before running unrelated cleanup queries.
