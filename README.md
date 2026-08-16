# Job Application Tracker

A modern, self-hosted job application tracker built with **Next.js**, **Supabase**, **Tailwind CSS**, and optional **Groq AI**.

Track applications, interview rounds, assessments, resumes, notes, lifecycle history, and outcomes in one place.

> Designed for private or small-team use. User registration is invitation-only.

## Features

### Job tracking

- Add, edit, and delete job applications
- Track top-level statuses: `Bookmarked`, `Applied`, `Interviewing`, `Offer`, `Rejected`, and `Ghosted`
- New applications default to `Applied`
- Keep `Bookmarked` for roles you saved but have not applied to yet
- Save company, role, location, source, job link, date, notes, and resume
- Search by company, role, location, or interview stage
- Filter by application status
- Live statistics for applications, interviews, and offers

### Application lifecycle and interview stages

Each application can have its own ordered pipeline instead of being limited to generic statuses.

Examples:

```text
Applied
Recruiter Screening
Coding Assessment
Technical Interview - Round 1
Technical Interview - Round 2
Hiring Manager Interview
Final Interview
```

You can:

- add unlimited interview/assessment stages
- use built-in stage templates or custom names
- reorder future stages
- start, complete, skip, or reject at a stage
- record exactly which round an application was rejected at
- preserve a timestamped lifecycle history
- keep one active/current stage per application

Stage history is stored separately from the high-level application status, so an application can remain `Interviewing` while still showing exactly which round it is in.

### AI-assisted job import

Paste a job-posting URL and let the importer fill in:

- Job title
- Company
- Location
- Source
- Job summary
- Responsibilities
- Required qualifications
- Preferred skills

When `GROQ_API_KEY` is configured, Groq produces structured notes. Without Groq, the app falls back to job-page metadata and JSON-LD where available.

### Authentication and admin

- Email/password sign-in
- Password recovery
- Magic-link sign-in
- Invitation-only onboarding
- Secure admin dashboard at `/admin`
- Invite users, update user details, send recovery links, and delete users/data
- Supabase Row-Level Security keeps user data isolated

### Resumes

- Upload PDF resumes up to 5 MB
- Resume files are stored under each user's folder in the `resumes` bucket
- The current implementation uses public resume URLs

> For sensitive deployments, consider switching the bucket to private storage and signed URLs.

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, Radix UI, shadcn/ui |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File storage | Supabase Storage |
| AI extraction | Groq API, optional |
| Deployment | Vercel or another Node.js-compatible platform |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/AryanKedare/job-application-tracker.git
cd job-application-tracker
npm install
```

### 2. Create a Supabase project

Create a project in Supabase, then open **Project Settings → API** and copy:

- Project URL
- anon/public key
- service-role key

Keep the service-role key server-side only.

### 3. Run the complete database setup

All database tables, indexes, RLS policies, lifecycle triggers, lifecycle history, and resume storage policies are consolidated into one file:

```text
supabase/setup.sql
```

For a **fresh installation**:

1. Open **Supabase → SQL Editor**.
2. Create a new query.
3. Copy the full contents of `supabase/setup.sql`.
4. Run it once.

That single file creates/configures:

- `job_applications`
- `application_stages`
- `application_stage_events`
- indexes
- Row-Level Security policies
- lifecycle/event triggers
- `resumes` storage bucket
- resume storage policies

The script is designed to be idempotent, so it can also be run on an existing installation to add the newer lifecycle schema. Existing `Bookmarked` rows are preserved; only the default for newly created applications becomes `Applied`.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for the full setup and upgrade guide.

### 4. Configure authentication URLs

In **Supabase → Authentication → URL Configuration**:

For local development:

```text
Site URL: http://localhost:3000
```

Add:

```text
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/reset-password**
```

For production, replace the domain with your deployed URL.

### 5. Check email templates

The password-reset template should use Supabase's generated confirmation URL:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

Invitation and magic-link templates should also use the generated confirmation URL.

### 6. Create `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters

# Optional
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile
LOGO_DEV_PUBLISHABLE_KEY=your-logo-dev-publishable-key
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, or `GROQ_API_KEY` with a `NEXT_PUBLIC_` prefix.

Generate an admin session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 7. Start the app

```bash
npm run dev
```

Open:

- App: `http://localhost:3000`
- User login: `http://localhost:3000/login`
- Admin: `http://localhost:3000/admin`

## Existing installation upgrade

If you already have `job_applications` and resume storage configured, you no longer need to apply separate lifecycle SQL snippets.

Run the current:

```text
supabase/setup.sql
```

The script uses `if not exists`, policy recreation, and safe `alter table ... add column if not exists` operations where appropriate. It will:

- keep existing application rows
- keep existing `Bookmarked` statuses unchanged
- change only the default status for new rows to `Applied`
- create the lifecycle tables if missing
- add rejection-stage fields
- add lifecycle triggers and history
- create a starting history event for pre-existing applications that do not already have lifecycle events

Back up production data before applying schema changes as normal operational practice.

## Application lifecycle behaviour

### New applications

A newly added application starts as:

```text
Applied
```

### Starting an interview stage

Starting a stage automatically moves the high-level status to:

```text
Interviewing
```

### Completing a round

Completing a round does **not** automatically start the next one. This keeps the history accurate when a recruiter rejects the application after a completed round but before the next round actually begins.

### Rejection

Rejecting at a stage records:

- application status = `Rejected`
- rejected stage name
- rejected timestamp
- lifecycle event snapshot

This lets the app show outcomes such as:

```text
Rejected at: Technical Interview - Round 2
```

## First-time user setup

1. Open `/admin`.
2. Sign in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Invite the user by name/email.
4. The user follows the invitation link and sets a password.
5. The user can then sign in with password or magic link.

See [ADMIN_SETUP.md](ADMIN_SETUP.md) for admin-specific configuration.

## Deploying to Vercel

1. Import the repository into Vercel.
2. Add all required environment variables.
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain.
4. Add that domain to Supabase authentication redirect URLs.
5. Run `supabase/setup.sql` against the production Supabase project.
6. Deploy/redeploy.
7. Test authentication, application creation, stage tracking, resume upload, and deletion flows.

## Project structure

```text
app/
├── admin/                    Admin dashboard
├── api/
│   ├── admin/                Server-side admin endpoints
│   ├── company-logo/         Company-logo resolver
│   └── jobs/import/          Job-page/Groq importer
├── auth/callback/            Supabase auth callback
├── jobs/                     Application dashboard
├── login/                    User authentication
├── reset-password/           Password setup/recovery
└── page.tsx                  Landing/account overview

components/
├── AddJobDialog.tsx                 Add/edit application form
├── ApplicationLifecycleDialog.tsx   Interview-stage and history manager
├── AccountSettingsDialog.tsx        Account/data controls
├── DeleteConfirmDialog.tsx          Delete confirmation
├── Toast.tsx                        User feedback
└── ui/                              Reusable UI primitives

lib/
├── admin-auth.ts
├── admin-request.ts
├── admin-supabase.ts
├── supabase.ts
└── types.ts

supabase/
└── setup.sql                 Canonical one-file database/storage setup

docs/
└── INSTALLATION.md           Detailed fresh-install and upgrade guide
```

## Security overview

The project includes:

- Supabase Row-Level Security for applications and stages
- immutable lifecycle history for normal users
- user-scoped queries
- server-only service-role usage
- signed admin sessions
- invitation-only user creation
- URL/SSRF protections for job imports
- PDF type and size validation for resumes
- Content Security Policy and other security headers

Deployment responsibilities include:

- use a long unique admin password
- keep `.env.local` out of Git
- never expose the service-role key
- review RLS/storage policies before public use
- consider private resume storage for sensitive data
- add rate limiting for larger public deployments

## Troubleshooting

### Stage tracking says the schema is missing

Run the complete `supabase/setup.sql` file in the Supabase SQL Editor. After it succeeds, refresh the application.

### Resume upload fails

Confirm `supabase/setup.sql` completed successfully, the `resumes` bucket exists, the user is authenticated, and the file is a PDF under 5 MB.

### Database request is denied

Confirm Row-Level Security policies were created by `supabase/setup.sql` and that the row belongs to the authenticated user's `user_id`.

### AI import returns limited information

Confirm `GROQ_API_KEY` is set. Some job boards block automated requests or render content only with client-side JavaScript.

### Password-reset link does not open the reset form

Check Supabase redirect URLs, `NEXT_PUBLIC_SITE_URL`, and email templates using `{{ .ConfirmationURL }}`. Generate a new recovery email after changing settings.

## Useful commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Contributing

1. Fork the repository.
2. Create a branch from `main`.
3. Make and test the change.
4. Run `npm run lint` and `npm run build`.
5. Open a focused pull request.

Do not commit credentials, `.env.local`, private resumes, or database exports.

## License

No open-source license file is currently included. Until one is added, standard copyright rules apply.
