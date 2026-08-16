# Admin Portal Setup

The admin portal is available at `/admin` and uses server-only environment variables.

## 1. Complete Supabase setup first

Before using the admin portal, run the repository's canonical SQL setup file in **Supabase → SQL Editor**:

```text
supabase/setup.sql
```

That one file creates/configures the application tables, interview-stage lifecycle tables, Row-Level Security policies, lifecycle triggers, resume bucket, and resume storage policies.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for the complete fresh-install and upgrade process.

## 2. Configure admin environment variables

Add these variables in Vercel for Production and Preview, or to `.env.local` for local development:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_SESSION_SECRET=use-at-least-32-random-characters
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

The application also requires:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Never use a `NEXT_PUBLIC_` prefix for:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

The Supabase service-role key bypasses Row-Level Security and must remain server-only.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Admin capabilities

The admin portal can:

- show total users and total job applications
- show active users and average jobs per user
- search users
- invite new users by name/email
- edit a user's name or email
- send password-recovery emails
- send magic links
- delete a user and their application data
- remove files from that user's `resumes/<user-id>` storage folder

Deleting a job application also cascades its interview stages and lifecycle event records through the database relationships configured in `supabase/setup.sql`.

## 4. Security notes

- Use a long, unique admin password.
- Keep the service-role key out of browser code and client logs.
- Do not commit `.env.local`.
- Rotate credentials immediately if they are exposed.
- Restrict access to the admin URL at the infrastructure layer as well when deploying for an organisation.
