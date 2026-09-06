# Job Application Tracker

A self-hosted job application tracker built with **Next.js**, **Supabase**, **Tailwind CSS**, **Resend**, and optional **Groq AI**.

Track applications, lifecycle stages, resumes, notes, outcomes, company logos, and AI-generated pipeline insights in one place.

> Registration is invitation-only. The application is intended for personal or small-team deployments where the operator controls the Supabase, Resend, Groq, and hosting accounts.

## Features

### Job tracking

- Add, edit, and delete job applications
- Track `Bookmarked`, `Applied`, `Interviewing`, `Offer`, `Rejected`, and `Ghosted`
- Search and filter by company, role, location, source, status, or lifecycle stage
- Store job links, dates, notes, job-description text, and resumes
- Export application data to CSV

### Application lifecycle

Each application can have an ordered interview/assessment pipeline. Users can add custom stages, start/complete/skip/reject stages, reorder future stages, and retain append-only lifecycle history.

### AI-assisted job import

Paste a public job-posting URL and Job Tracker attempts to extract:

- job title
- company
- location
- source
- job summary
- responsibilities
- required qualifications
- preferred skills

The importer first uses structured page data, JSON-LD, embedded SPA data, and supported platform-specific APIs such as Oracle Recruiting. Groq is then used as a structured extraction/normalization layer when configured.

`GROQ_IMPORT_MODEL` is separate from the logo and analysis models so each task can use an appropriate cost/quality profile.

### Automatic company logos

The dashboard resolves a saved company name to an official company domain, discovers a safe raster favicon/logo, and falls back to Groq Compound Mini web search only when normal official-site discovery fails.

Resolved public company metadata is stored in the server-only `company_logo_cache` table so Vercel cold starts do not repeatedly spend AI credits on the same company.

### AI application analysis PDF

Users can request a detailed AI-assisted application analysis from **Account settings → AI analysis**. The server calculates deterministic pipeline metrics, asks the configured analysis model for structured observations/recommendations, generates a PDF, and emails it to the user's confirmed account address through Resend.

Users can also opt in to an automatic month-end analysis email. The recurring option is off by default and is controlled independently from product/changelog email preferences.

### Authentication and administration

- Email/password sign-in
- Magic-link sign-in
- Password recovery
- Invitation-only onboarding
- Single-use invite codes
- Optional access-request flow
- Server-side admin portal at `/admin`
- User invitations, recovery links, magic links, profile updates, and deletion
- Admin product/update emails to all users, selected users, or custom email addresses
- User-controlled product/changelog email opt-out and signed unsubscribe flow
- Supabase Row-Level Security for user data isolation

### Private resumes

- PDF upload up to 5 MB
- Private Supabase Storage bucket
- Per-user storage folders
- Bucket-relative object paths stored in the database
- Short-lived signed URLs for resume access
- Cleanup for failed uploads, replacement, application deletion, and account deletion

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, Radix UI |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File storage | Supabase Storage |
| Email delivery | Resend API; Supabase Auth email can use Resend SMTP |
| AI | Groq API, optional |
| Deployment | Vercel or another Node.js-compatible platform |

## One-time setup

Fresh deployments have one canonical setup path:

1. Clone the repository and install dependencies.
2. Create a Supabase project.
3. Run the complete `supabase/setup.sql` once in the Supabase SQL Editor.
4. Configure Supabase Auth URLs/templates.
5. Configure environment variables from `.env.example`.
6. Optionally configure Resend and Groq.
7. Deploy and invite the first user from `/admin`.

Use **[docs/ONE_TIME_SETUP.md](docs/ONE_TIME_SETUP.md)** for the complete step-by-step setup.

For a fresh installation, do **not** assemble SQL from old commits or dated migrations. `supabase/setup.sql` is the canonical, idempotent database/storage setup and also serves as the supported upgrade path for older installations.

## Database setup

The canonical SQL creates/configures:

- `public.job_applications`
- `public.application_stages`
- `public.application_stage_events`
- `public.invite_codes`
- `public.company_logo_cache`
- indexes and constraints
- Row-Level Security policies
- lifecycle/event trigger functions
- append-only lifecycle history
- private `resumes` Storage bucket
- PDF size/MIME restrictions
- per-user resume Storage policies

## Environment variables

Start from `.env.example`.

### Required core configuration

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-domain.example
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
```

### Optional access request

```env
NEXT_PUBLIC_ACCESS_REQUEST_EMAIL=
```

Leave it blank to hide the **Request access** flow.

### Resend-powered application mail

```env
RESEND_API_KEY=
RESEND_FROM=Job Tracker <updates@your-domain.example>
EMAIL_UNSUBSCRIBE_SECRET=replace-with-a-long-random-secret
```

These values enable admin update emails, signed product-update unsubscribe links, and emailed analysis PDFs. They are separate from any Supabase Auth SMTP configuration used for password recovery or magic links.

### Groq AI

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_IMPORT_MODEL=openai/gpt-oss-20b
GROQ_LOGO_MODEL=llama-3.1-8b-instant
GROQ_LOGO_WEB_MODEL=groq/compound-mini
GROQ_ANALYSIS_MODEL=openai/gpt-oss-20b
```

Task-specific model variables are optional; the application has defaults/fallbacks. The split prevents simple logo resolution from using the same model as long-form job extraction or detailed application analysis.

### Month-end analysis automation

```env
CRON_SECRET=replace-with-a-long-random-secret
```

`vercel.json` schedules `/api/cron/monthly-analysis` for 18:00 UTC on days 28-31. The route sends only when the current UTC date is actually the final day of the month and only to users who explicitly enabled **Monthly analysis email**.

### Maintenance mode

```env
MAINTENANCE_MODE=false
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `RESEND_API_KEY`, `EMAIL_UNSUBSCRIBE_SECRET`, `CRON_SECRET`, or `GROQ_API_KEY` with a `NEXT_PUBLIC_` prefix.

## Vercel deployment behavior

Automatic Git deployments are intentionally disabled in `vercel.json`:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

Pushes and pull-request updates therefore do not automatically create Vercel Preview/Production deployments. Deploy manually when you are ready to publish a release. After changing `vercel.json`, cron configuration, environment variables, or server code, perform a manual Production deployment for those changes to become live.

## Privacy and AI data handling

The analysis model receives only pipeline metadata needed for the report, such as company, role, status, dates, source/location, and lifecycle stages. It does not receive the user's email address, resume files, resume storage paths, private notes, passwords, or authentication tokens.

Company-logo AI receives only the company name and previously inferred public domain information.

Job import necessarily processes the job-posting content being imported.

## Security

The application includes:

- owner-scoped RLS for application/stage data
- read-only lifecycle history for normal users
- server-only invite-code and company-logo cache tables
- private resume storage
- signed resume URLs
- SSRF/private-network protections for job import and logo fetching
- server-only admin, Resend, Groq, cron, and service-role secrets

See **[SECURITY.md](SECURITY.md)** before exposing a deployment to the internet.

## Documentation

- [One-time setup](docs/ONE_TIME_SETUP.md)
- [Admin portal and email setup](ADMIN_SETUP.md)
- [AI models, analysis reports, and automation](docs/AI_ANALYSIS.md)
- [Automatic company logos](docs/COMPANY_LOGOS.md)
- [Public release checklist](docs/PUBLIC_RELEASE.md)
- [Security policy](SECURITY.md)

## Useful commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
```

## Contributing

Use focused pull requests and avoid committing credentials, `.env.local`, resumes, production database exports, or private user data.

## License

No `LICENSE` file is currently included. The repository is source-visible, but it should not be described as open source until a license is intentionally selected and added.
