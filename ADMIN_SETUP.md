# Admin Portal Setup

The admin portal is available at `/admin` and uses server-only environment variables.

## 1. Complete Supabase setup first

Before using the admin portal, run the repository's canonical SQL setup file in **Supabase → SQL Editor**:

```text
supabase/setup.sql
```

That one file creates/configures the application tables, interview-stage lifecycle tables, invite-code storage, Row-Level Security policies, lifecycle triggers, resume bucket, and resume storage policies.

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
- generate single-use invite codes for self-service onboarding that expire after 15 minutes
- edit a user's name or email
- send password-recovery emails
- send magic links
- delete a user and their application data
- remove files from that user's `resumes/<user-id>` storage folder

Invite codes are stored only as SHA-256 hashes in `public.invite_codes`. A code is atomically marked used when redemption begins, cannot be redeemed a second time, and is released again only if sending the onboarding email fails.

Deleting a job application also cascades its interview stages and lifecycle event records through the database relationships configured in `supabase/setup.sql`.

## 4. Maintenance mode

The app includes a dedicated maintenance page for planned upgrades and improvements.

To enable it, add or change this server-side environment variable in Vercel and redeploy:

```env
MAINTENANCE_MODE=true
```

While maintenance mode is enabled:

- normal visitors see the maintenance page on user-facing routes
- non-admin API requests return HTTP `503 Service Unavailable`
- `/admin` and `/api/admin/*` remain available so administrators can continue working
- a browser with a valid signed admin session can bypass maintenance mode and use the real production application
- Next.js static assets remain available so the maintenance page renders normally

### Test production while maintenance mode stays enabled

1. Open `/admin` in your normal browser and sign in as administrator.
2. In the same browser, open `/jobs` or `/login`. The valid admin session cookie bypasses maintenance mode.
3. If you need to test user-specific features, sign in to a normal Job Tracker user account in that same browser and test the full production workflow.
4. Open the production site in an incognito/private window (where the admin cookie is absent) and confirm normal visitors still see the maintenance page.
5. Signing out of the admin portal removes the bypass; subsequent user-facing requests in that browser return to maintenance mode.

The bypass uses the existing signed, HTTP-only admin session cookie. There is no query-string bypass token or additional public secret.

To restore normal access for everyone, set the variable to `false` (or remove it) and redeploy:

```env
MAINTENANCE_MODE=false
```

`MAINTENANCE_MODE` is intentionally server-side and should not use the `NEXT_PUBLIC_` prefix.

## 5. Security notes

- Use a long, unique admin password.
- Keep the service-role key out of browser code and client logs.
- Do not commit `.env.local`.
- Rotate credentials immediately if they are exposed.
- Restrict access to the admin URL at the infrastructure layer as well when deploying for an organisation.
