# Job Application Tracker

A modern, self-hosted job application tracker built with **Next.js**, **Supabase**, **Tailwind CSS**, and optional **Groq AI**.

Track applications, save job descriptions and CVs, search and filter your pipeline, invite users, and manage the whole installation from a secure admin dashboard.

> This project is designed for private or small-team use. User registration is invitation-only.

## Features

### Job tracking

- Add, edit, and delete job applications
- Track six statuses: `Bookmarked`, `Applied`, `Interviewing`, `Offer`, `Rejected`, and `Ghosted`
- Save company, role, location, source, application link, date, notes, and resume
- Search by company, role, or location
- Filter applications by status
- Live statistics for applications, interviews, and offers
- Responsive table layout for desktop and smaller screens
- Long notes open in a scrollable modal

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

The importer includes URL validation, redirect limits, response-size limits, timeouts, and checks that block private or local network addresses.

### Authentication

- Email and password sign-in
- Password recovery
- Magic-link sign-in
- Invitation-only user onboarding
- Password-reset page for recovery and invitation links
- Supabase session handling

Public sign-up is disabled. New users are invited from the admin dashboard.

### Admin dashboard

The admin dashboard is available at `/admin` and includes:

- Separate admin email and password authentication
- Total users, total applications, active users, and average jobs per user
- User search
- Invite users by name and email
- Send onboarding, password-recovery, and magic-link emails
- Update a user's name or email
- Delete a user, their job rows, and their resume files

Admin actions use the Supabase service-role key on the server only.

### Company logos

Company logos are resolved server-side using:

1. Logo.dev, when an optional publishable key is configured
2. Wikidata and Wikimedia Commons
3. The company's official website metadata
4. A coloured initials avatar when no logo can be found

The app does not use job-board favicons as company logos.

### Account and data controls

- Update display name
- Export application data
- Delete application data
- Delete account
- Upload PDF resumes up to 5 MB
- Row-Level Security keeps each user's job records separate

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

## Before you begin

Install these first:

- Node.js 20 or newer
- npm
- A Supabase account
- A Vercel account for the easiest deployment
- A Groq account only when AI extraction is required

## Quick start

### 1. Clone the project

```bash
git clone https://github.com/AryanKedare/job-application-tracker.git
cd job-application-tracker
npm install
```

### 2. Create a Supabase project

1. Sign in to Supabase.
2. Create a new project.
3. Wait for the database to finish provisioning.
4. Open **Project Settings → API**.
5. Copy the project URL, anon key, and service-role key.

Keep the service-role key secret. Never expose it in browser code or use a `NEXT_PUBLIC_` prefix.

### 3. Create the database table

Open **Supabase → SQL Editor**, create a new query, and run:

```sql
create extension if not exists pgcrypto;

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_title text not null,
  company text,
  job_link text,
  status text not null default 'Bookmarked'
    check (status in ('Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted')),
  date_applied date,
  location text,
  source text,
  resume_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists job_applications_user_id_idx
  on public.job_applications(user_id);

create index if not exists job_applications_user_date_idx
  on public.job_applications(user_id, date_applied desc);

alter table public.job_applications enable row level security;

drop policy if exists "Users can read their applications" on public.job_applications;
drop policy if exists "Users can create their applications" on public.job_applications;
drop policy if exists "Users can update their applications" on public.job_applications;
drop policy if exists "Users can delete their applications" on public.job_applications;

create policy "Users can read their applications"
  on public.job_applications
  for select
  using (auth.uid() = user_id);

create policy "Users can create their applications"
  on public.job_applications
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their applications"
  on public.job_applications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their applications"
  on public.job_applications
  for delete
  using (auth.uid() = user_id);
```

### 4. Create the resume bucket

In **Supabase → Storage**:

1. Click **New bucket**.
2. Name it `resumes`.
3. Make it public because the current application stores public resume URLs.
4. Set a file-size limit of 5 MB when available.
5. Restrict accepted files to PDF when available.

Then run these storage policies in the SQL Editor:

```sql
alter table storage.objects enable row level security;

drop policy if exists "Users can upload their resumes" on storage.objects;
drop policy if exists "Users can update their resumes" on storage.objects;
drop policy if exists "Users can delete their resumes" on storage.objects;

create policy "Users can upload their resumes"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their resumes"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their resumes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

> Privacy note: a public bucket means anyone with a resume URL can access that file. For highly sensitive deployments, migrate the app to a private bucket with signed URLs before inviting users.

### 5. Configure authentication URLs

Open **Supabase → Authentication → URL Configuration**.

For local development, use:

```text
Site URL: http://localhost:3000
```

Add these redirect URLs:

```text
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/reset-password**
```

For production, replace the domain with your real application URL:

```text
https://your-domain.example/**
https://your-domain.example/auth/callback
https://your-domain.example/reset-password**
```

Using the wildcard entry is convenient for previews. For a stricter production setup, list only the exact routes required by the application.

### 6. Check the Supabase email templates

Open **Supabase → Authentication → Email Templates**.

The password-reset template must link to `ConfirmationURL`:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

Do not hardcode `SiteURL` as the reset button destination.

The invitation and magic-link templates should also use Supabase's generated confirmation URL. After changing a template or redirect setting, request a new email because old emails keep their original links.

### 7. Create the environment file

Create `.env.local` in the repository root:

```env
# Public Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Server-only Supabase key used by the admin dashboard
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Separate admin login
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters

# Optional AI import
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=llama-3.3-70b-versatile

# Optional higher-priority company-logo provider
LOGO_DEV_PUBLISHABLE_KEY=your-logo-dev-publishable-key
```

Required variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | Base URL used in auth emails and redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for admin user management |
| `ADMIN_EMAIL` | Email accepted by `/admin` |
| `ADMIN_PASSWORD` | Password accepted by `/admin` |
| `ADMIN_SESSION_SECRET` | Signs the admin session cookie; use at least 32 random characters |

Optional variables:

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables structured AI extraction from job pages |
| `GROQ_MODEL` | Overrides the default Groq model |
| `LOGO_DEV_PUBLISHABLE_KEY` | Uses Logo.dev before the free logo fallbacks |

Never prefix `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or `GROQ_API_KEY` with `NEXT_PUBLIC_`.

Generate a session secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 8. Start the application

```bash
npm run dev
```

Open:

- Application: `http://localhost:3000`
- User login: `http://localhost:3000/login`
- Admin login: `http://localhost:3000/admin`

## First-time user setup

The application is invitation-only.

1. Open `/admin`.
2. Sign in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Enter the user's name and email.
4. Send the invitation.
5. The user follows the email link and sets a password.
6. The user can later sign in with password or request a magic link.

If an invitation or reset link goes to the homepage, verify:

- `NEXT_PUBLIC_SITE_URL` matches the deployed domain
- The domain and reset-password route are allowed in Supabase redirect URLs
- The email template uses `{{ .ConfirmationURL }}`
- A newly generated email is being tested

## AI import behaviour

When a user clicks **Auto-fill details**, the server:

1. Validates the URL.
2. Blocks local and private network targets.
3. Downloads a limited amount of HTML with a timeout.
4. Reads structured `JobPosting` metadata when available.
5. Sends cleaned job text to Groq when configured.
6. Returns structured notes containing summary, responsibilities, required qualifications, and preferred skills.

Some websites render job descriptions only with client-side JavaScript or block automated requests. Those pages may return partial details or require manual entry.

## Deploying to Vercel

### 1. Import the repository

1. Push your fork to GitHub.
2. Sign in to Vercel.
3. Click **Add New → Project**.
4. Import the repository.
5. Keep the default Next.js build settings.

### 2. Add environment variables

Add every required variable from `.env.local` under:

**Vercel → Project → Settings → Environment Variables**

Add them to Production and Preview when both environments are used.

For production, set:

```env
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
```

Environment-variable changes affect new deployments only. Redeploy after adding or changing variables.

### 3. Update Supabase URLs

Set the Supabase Site URL to the production domain and add the production redirect URLs listed earlier.

### 4. Test the complete flow

Before inviting real users, test:

- Admin login
- User invitation
- Password creation
- Password sign-in
- Magic-link sign-in
- Forgot-password flow
- Adding and editing an application
- Resume upload and download
- AI import
- Account deletion

## Project structure

```text
app/
├── admin/                    Admin login and user-management dashboard
├── api/
│   ├── admin/                Server-only admin authentication and user actions
│   ├── company-logo/         Company-logo resolver and proxy
│   └── jobs/import/          Job-page and Groq extraction endpoint
├── auth/callback/            Supabase magic-link callback
├── jobs/                     Main application-tracking dashboard
├── login/                    User sign-in and password recovery
├── reset-password/           Password setup and recovery page
└── page.tsx                  Landing and account overview

components/
├── AddJobDialog.tsx          Add/edit form and AI import interface
├── AccountSettingsDialog.tsx Account and data controls
├── DeleteConfirmDialog.tsx   Destructive-action confirmation
├── Toast.tsx                 User feedback
└── ui/                       Reusable UI primitives

lib/
├── admin-auth.ts             Admin credential and signed-cookie logic
├── admin-request.ts          Admin request protection
├── admin-supabase.ts         Server-only service-role client
├── supabase.ts               Browser Supabase client
└── types.ts                  Shared application types
```

## Security overview

The project includes:

- Supabase Row-Level Security for application rows
- User-scoped database queries
- Server-only service-role usage
- HTTP-only signed admin session cookies
- Cross-origin checks for admin mutations
- Invitation-only user creation
- URL and SSRF protections in external page fetchers
- File type and size validation for resumes
- Content Security Policy and other security headers
- Generic authentication errors to reduce account discovery

Important deployment responsibilities:

- Use a long, unique admin password
- Rotate the service-role key immediately if it is exposed
- Keep `.env.local` out of Git
- Do not log secret environment values
- Review Supabase RLS and Storage policies before public use
- Consider private resume storage with signed URLs for sensitive data
- Add rate limiting to admin login, auth email actions, and AI import for larger public deployments

## Troubleshooting

### `ADMIN_EMAIL is not configured`

The variable is missing from the deployment currently serving the page. Check the exact Vercel environment—Preview or Production—and redeploy after saving it.

### AI import returns only basic information

Confirm `GROQ_API_KEY` is configured. Without it, the app uses page metadata. Also note that some job boards block server fetches or hide content behind JavaScript.

### AI import fails for internal or local URLs

This is intentional. The importer blocks localhost, private IP ranges, link-local addresses, and unsafe redirects.

### Password-reset link signs in but does not show the reset form

Check the Supabase redirect URLs, confirm the email template uses `{{ .ConfirmationURL }}`, deploy the latest code, and request a new reset email.

### Company logo shows initials

No reliable logo was found. Add `LOGO_DEV_PUBLISHABLE_KEY` for broader coverage, or extend the aliases in `app/api/company-logo/route.ts`.

### Resume upload fails

Confirm the `resumes` bucket exists, the user-folder storage policies are installed, the file is a PDF, and it is under 5 MB.

### Database request is denied

Confirm Row-Level Security policies exist and the row's `user_id` matches the authenticated user's ID.

## Useful commands

```bash
npm run dev      # Start development server
npm run build    # Create a production build
npm run start    # Run the production build
npm run lint     # Run ESLint
```

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a branch from `main`.
3. Make and test the change.
4. Run `npm run lint` and `npm run build`.
5. Open a focused pull request.

Please avoid committing credentials, `.env.local`, private resumes, or production database exports.

## License

No open-source license file is currently included. Until a license is added, standard copyright rules apply and reuse rights are not automatically granted.
