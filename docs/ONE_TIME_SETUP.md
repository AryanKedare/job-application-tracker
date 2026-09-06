# One-Time Setup

This is the canonical fresh-install guide for Job Application Tracker.

For a new deployment, use this document together with:

```text
supabase/setup.sql
.env.example
```

Do not assemble a fresh installation from SQL snippets in old commits, issues, or historical migrations. The current `supabase/setup.sql` is intentionally idempotent and contains the complete database/storage setup required by the current application.

## 1. Prerequisites

You need:

- Node.js and npm
- a Supabase project
- a deployment platform capable of running Next.js server routes
- optionally, a Groq account for AI features
- optionally, a Resend account/domain for admin update emails and emailed analysis PDFs

Vercel is the reference deployment platform because the repository includes a Vercel Cron configuration for month-end analysis.

## 2. Clone and install

```bash
git clone https://github.com/AryanKedare/job-application-tracker.git
cd job-application-tracker
npm install
```

## 3. Create a Supabase project

Create a new Supabase project and wait for the database to become available.

Record:

- Project URL
- anon/public key
- service-role key

The service-role key bypasses Row-Level Security. It must remain server-side and must never use a `NEXT_PUBLIC_` prefix.

## 4. Run the canonical SQL once

Open **Supabase → SQL Editor**, create a new query, paste the complete contents of:

```text
supabase/setup.sql
```

Run it.

The setup creates/configures:

- `public.job_applications`
- `public.application_stages`
- `public.application_stage_events`
- `public.invite_codes`
- `public.company_logo_cache`
- indexes and constraints
- application/stage Row-Level Security
- append-only lifecycle history
- lifecycle/status triggers
- server-only invite-code access
- server-only company-logo cache access
- private `resumes` Storage bucket
- 5 MB PDF-only resume restrictions
- owner-scoped resume read/write/delete policies
- conversion of recognized legacy public resume URLs into bucket-relative paths

The file can be re-run later as the supported schema/policy upgrade path. A fresh install does not require any additional migration SQL.

## 5. Verify Supabase

In **Table Editor**, confirm these tables exist:

```text
job_applications
application_stages
application_stage_events
invite_codes
company_logo_cache
```

In **Storage**, confirm:

```text
Bucket: resumes
Public: false
File size limit: 5 MB
Allowed MIME type: application/pdf
```

Expected access model:

- authenticated users can access only their own applications
- authenticated users can access stages only for their own applications
- authenticated users can read their own lifecycle history but cannot directly mutate history rows
- browser roles cannot access `invite_codes`
- browser roles cannot access `company_logo_cache`
- resume access is restricted to objects whose top-level folder is the authenticated user's ID

Supabase/PostgREST can take a few seconds to refresh its schema cache after setup.

## 6. Configure Supabase Auth URLs

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

For production, use the exact deployed HTTPS origin instead of `localhost` and remove development-only redirects you do not need.

## 7. Configure Supabase Auth email templates

Invitation, magic-link, and password-recovery templates should use Supabase-generated confirmation URLs instead of hard-coding your application URL.

For example:

```html
<a href="{{ .ConfirmationURL }}">Continue</a>
```

If you use Resend SMTP for Supabase Auth, configure that inside Supabase Auth/SMTP settings. That is separate from the application's `RESEND_API_KEY`, which is used by server routes for admin updates and analysis PDFs.

After changing auth URL/template settings, generate a new email before retesting because previously generated links keep their old destination.

## 8. Create the local environment file

```bash
cp .env.example .env.local
```

Then replace the placeholders you need.

### Required core variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

Generate a strong session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use a unique administrator password that is not reused for Supabase, GitHub, Vercel, email, or another service.

## 9. Optional access-request flow

```env
NEXT_PUBLIC_ACCESS_REQUEST_EMAIL=
```

If configured, the login page can show **Request access**. The application checks whether the submitted address is already registered before opening a pre-filled `mailto:` draft.

If blank/unset, the access-request button and endpoint are disabled.

This flow intentionally reveals to the requester whether the submitted email already has an account. Leave it disabled if that behavior is not suitable for your deployment.

## 10. Optional Resend application email

To enable admin product/update emails and emailed AI analysis PDFs, verify a sending domain in Resend and configure:

```env
RESEND_API_KEY=re_...
RESEND_FROM=Job Tracker <updates@your-domain.example>
EMAIL_UNSUBSCRIBE_SECRET=replace-with-a-long-random-secret
```

Generate the unsubscribe signing secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The application does not require Resend Contacts or Segments. Supabase Auth remains the source of truth for users; Resend is used as delivery transport.

`EMAIL_UNSUBSCRIBE_SECRET` signs product-update unsubscribe links. Do not reuse `ADMIN_SESSION_SECRET` for this purpose.

## 11. Optional Groq AI

Configure:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_IMPORT_MODEL=openai/gpt-oss-20b
GROQ_LOGO_MODEL=llama-3.1-8b-instant
GROQ_LOGO_WEB_MODEL=groq/compound-mini
GROQ_ANALYSIS_MODEL=openai/gpt-oss-20b
```

Task split:

- `GROQ_IMPORT_MODEL` — Add Job / job-description extraction
- `GROQ_LOGO_MODEL` — low-cost company-name → official-domain resolution
- `GROQ_LOGO_WEB_MODEL` — last-resort web-search logo discovery
- `GROQ_ANALYSIS_MODEL` — detailed manual/month-end application analysis
- `GROQ_MODEL` — general fallback

The task-specific variables are optional because the application provides defaults/fallbacks, but defining them explicitly makes production behavior easier to audit.

Without `GROQ_API_KEY`, AI-dependent enrichment/analysis gracefully degrades or is unavailable depending on the feature.

## 12. Month-end analysis automation

Users can opt in to **Monthly analysis email** from Account settings. It is off by default.

For Vercel Cron, configure a server-only secret:

```env
CRON_SECRET=replace-with-a-long-random-secret
```

The repository's `vercel.json` schedules:

```text
/api/cron/monthly-analysis
0 18 28-31 * *
```

The route runs on days 28-31 at 18:00 UTC but sends only when the current UTC date is actually the final calendar day of the month.

The route:

- requires `Authorization: Bearer <CRON_SECRET>`
- selects only confirmed users with `monthly_analysis_enabled: true`
- de-duplicates by user/month
- uses Resend idempotency keys
- stores the last successful month in protected Supabase Auth `app_metadata`

## 13. Optional maintenance mode

```env
MAINTENANCE_MODE=false
```

Set it to `true` during planned maintenance. Admin routes remain available according to the application's maintenance middleware behavior.

## 14. Start locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/admin
```

Sign in to `/admin` using `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then invite a disposable test user.

## 15. Validate before production

Run:

```bash
npm run lint
npm run build
```

Then test:

1. admin sign-in
2. invitation redemption
3. password recovery
4. magic-link sign-in
5. create/edit/delete application
6. Applied/Bookmarked lifecycle behavior
7. lifecycle stage transitions and rejection
8. resume upload/download/replacement/deletion
9. CSV export
10. job import from at least one normal site and one dynamic job platform you expect to use
11. company-logo resolution and cache reuse
12. product-update email test send
13. product-update opt-out in Account settings
14. signed unsubscribe confirmation flow
15. manual AI analysis PDF email
16. monthly analysis preference toggle
17. cron route rejects invalid authorization

## 16. Production deployment

Add the same production environment variables to your hosting platform, using your real HTTPS domain for `NEXT_PUBLIC_SITE_URL`.

### Vercel

Automatic Git deployments are disabled by repository configuration:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

This is intentional to avoid a deployment for every push/PR update.

After merging or changing production configuration, trigger a **manual Production deployment** in Vercel. The cron schedule and server changes become active only after the deployment containing them is live.

## 17. First production user

After the production deployment:

1. open `/admin` over HTTPS
2. sign in with the production admin credentials
3. invite a disposable test account first
4. complete the end-to-end checks above
5. delete the disposable account
6. invite real users only after the test succeeds

## Upgrading an existing installation

Before schema changes, take a database backup.

Run the current complete:

```text
supabase/setup.sql
```

The setup is designed to preserve existing application rows while bringing tables, indexes, policies, triggers, resume storage, and the company-logo cache to the current state.

It does not intentionally delete application rows or convert existing Bookmarked applications to Applied.

## Troubleshooting

### Missing table / schema-cache error

Re-run `supabase/setup.sql`, wait a few seconds for Supabase/PostgREST to refresh, then retry.

### Permission denied / RLS error

Confirm the authenticated user's `auth.uid()` matches the relevant `user_id`, then re-run the canonical setup to restore current policies.

### Resume upload fails

Verify the `resumes` bucket is private, the file is a PDF no larger than 5 MB, and the object path starts with the authenticated user's ID.

### Company logos keep consuming AI credits

Verify `public.company_logo_cache` exists and `SUPABASE_SERVICE_ROLE_KEY` is configured server-side. The persistent cache is what prevents Vercel cold starts from repeatedly resolving the same company through AI.

### AI report does not send

Verify `GROQ_API_KEY`, `RESEND_API_KEY`, and `RESEND_FROM` are configured and the account email is confirmed. Monthly reports additionally require `CRON_SECRET` and the user's monthly-analysis toggle to be enabled.

### Cron is configured but reports never arrive

Confirm the latest production deployment contains `vercel.json`, the cron appears in Vercel, `CRON_SECRET` is configured, and the user enabled **Monthly analysis email**. The route intentionally does nothing on non-final days of the month.

### A Git push did not deploy to Vercel

That is expected. Automatic Git deployments are disabled. Trigger a manual deployment when you want to publish.
