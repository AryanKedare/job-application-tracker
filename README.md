# Job Application Tracker

A self-hosted job application tracker built with **Next.js**, **Supabase**, **Tailwind CSS**, and optional **Groq AI**.

Track applications, interview rounds, assessments, resumes, notes, lifecycle history, and outcomes in one place.

> Registration is invitation-only. When access requests are enabled, the login page checks whether the entered email already belongs to an account before preparing an access-request email.

## Features

### Job tracking

- Add, edit, and delete job applications
- Track `Bookmarked`, `Applied`, `Interviewing`, `Offer`, `Rejected`, and `Ghosted`
- Search by company, role, location, or interview stage
- Filter by application status
- Store job links, source, notes, dates, and resumes
- View lightweight application/interview/offer statistics

### Application lifecycle

Each application can have its own ordered interview and assessment pipeline. You can add custom stages, start/complete/skip/reject stages, reorder future stages, and preserve append-only lifecycle history.

### AI-assisted job import

Paste a job-posting URL to extract role, company, location, source, summary, responsibilities, qualifications, and preferred skills. Groq is optional; without it the importer falls back to page metadata and JSON-LD.

The importer resolves and validates public addresses before connecting, pins outbound requests to vetted IP addresses, and repeats validation for redirects.

### Authentication and administration

- Email/password sign-in
- Magic-link sign-in
- Password recovery
- Invitation-only onboarding
- Single-use invite codes
- Optional access-request flow with an existing-account check
- Server-side admin portal at `/admin`
- User invitations, recovery links, magic links, profile updates, and deletion
- Supabase Row-Level Security for user data isolation

### Private resumes

- PDF upload up to 5 MB
- Private Supabase Storage bucket
- Per-user storage folders
- Bucket-relative object paths stored in the database
- Short-lived signed URLs for resume access
- Cleanup for failed uploads and resume replacement

## Technology stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, Radix UI |
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

Create a Supabase project and collect:

- project URL
- anon/public key
- service-role key

The service-role key must remain server-side.

### 3. Run the canonical database setup

For a fresh installation, run the complete contents of:

```text
supabase/setup.sql
```

That single setup file creates or configures:

- `job_applications`
- `application_stages`
- `application_stage_events`
- `invite_codes`
- indexes and constraints
- Row-Level Security policies
- lifecycle/event triggers
- append-only lifecycle history
- the private `resumes` bucket
- per-user resume read/write policies
- conversion of recognized legacy public resume URLs to object paths

Fresh installations do **not** need to run the dated security migration. `supabase/migrations/20260831_security_hardening.sql` is retained only for older deployments that need to apply the original hardening changes without re-running the current `setup.sql`.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for fresh-install, upgrade, verification, and troubleshooting steps.

### 4. Configure Supabase authentication URLs

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

Use your deployed HTTPS domain instead of `localhost` in production.

### 5. Configure environment variables

Copy `.env.example` to `.env.local` and replace every placeholder:

```bash
cp .env.example .env.local
```

Required values:

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

Set `NEXT_PUBLIC_ACCESS_REQUEST_EMAIL` only in your deployment environment if you want the login page to show **Request access**. If it is blank or unset, the button and the account-check endpoint are disabled.

Optional values:

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
MAINTENANCE_MODE=false
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, or `GROQ_API_KEY` with a `NEXT_PUBLIC_` prefix.

Generate a strong admin session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 6. Start the application

```bash
npm run dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/admin`

Use the admin portal to invite the first user.

## Invitation and access-request flow

Existing users can sign in by password or magic link. A person with a valid single-use invite code can create an account from the login page.

When `NEXT_PUBLIC_ACCESS_REQUEST_EMAIL` is configured, someone without an invite can enter their email and select **Request access**. Before a mail draft is opened, `/api/access-request` checks Supabase Auth for an exact email match using the server-side service-role client.

- If the account already exists, the user stays on the login page and is told to sign in with their existing credentials or use password recovery.
- If the account does not exist, the browser opens the configured email application with a pre-filled access request containing the entered email.
- The account-check endpoint is same-origin restricted, rate-limited on a best-effort basis, and disabled when access requests are not configured.

The request template is:

```text
Subject: Access request - Job Application Tracker

Hello,

I'd like to request access to Job Application Tracker.

Name:
Email: <entered email>
Reason for access:

Thanks.
```

The mail client still requires the requester to press **Send**; the application itself does not send email on their behalf or include mail-provider credentials.

Because the requested UX explicitly distinguishes existing from non-existing accounts, this flow reveals whether a submitted email is registered. Operators who do not want that behavior should leave `NEXT_PUBLIC_ACCESS_REQUEST_EMAIL` unset.

## Application lifecycle

Each application can have an ordered stage pipeline, for example:

```text
Applied
Recruiter Screening
Coding Assessment
Technical Interview - Round 1
Technical Interview - Round 2
Final Interview
```

Starting an interview stage moves the high-level application status to `Interviewing`. Rejecting a stage records the rejection timestamp and stage name. Lifecycle event rows are generated by trigger functions and are read-only to normal authenticated users.

## Resume security

Resume files are stored in the private `resumes` bucket under paths such as:

```text
<user-id>/<uuid>.pdf
```

The database keeps that bucket-relative object path in the historical `resume_url` column. The client requests a short-lived signed URL only when the authenticated owner opens the resume.

The upload flow also attempts to clean up newly uploaded files when the application save fails, and removes the previous resume only after a successful replacement is stored in the database.

## Job import security

`/api/jobs/import` is authenticated and treats the supplied job URL as untrusted input. The server:

- permits HTTP/HTTPS URLs only
- rejects private/reserved address ranges
- resolves the destination before connecting
- pins the request to the vetted IP address
- preserves the original Host header and TLS SNI
- repeats validation for each redirect
- limits redirects, time, response type, and response size

## Security

See [SECURITY.md](SECURITY.md) for the security model and vulnerability-reporting guidance.

Before exposing a deployment to the internet:

- use unique production credentials
- keep the service-role key server-only
- keep the resume bucket private
- verify RLS policies
- configure only trusted auth redirect URLs
- add rate limiting or edge protection appropriate to your deployment
- run dependency and secret scanning

## Documentation

- [Installation and database setup](docs/INSTALLATION.md)
- [Admin portal setup](ADMIN_SETUP.md)
- [Security policy](SECURITY.md)
- [Public release checklist](docs/PUBLIC_RELEASE.md)

## Useful commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Contributing

Contributions can be submitted through focused pull requests. Before opening a PR, run the lint and build commands and avoid committing credentials, `.env.local`, resumes, or database exports.

## License

No `LICENSE` file is currently included. The source may be publicly visible, but do not describe the repository as open source until a license has been intentionally selected and added.
