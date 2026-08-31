# Admin Portal Setup

The admin portal is available at `/admin` and uses server-only environment credentials plus a signed HTTP-only admin session cookie.

This admin model is intentionally simple and is best suited to personal or small-team deployments. For a public internet deployment, additionally protect `/admin` at the infrastructure layer where practical.

## 1. Complete the canonical Supabase setup

Before using the admin portal, run the current complete:

```text
supabase/setup.sql
```

Fresh installations do not require any additional security migration. The setup file creates/configures the application tables, lifecycle tables and triggers, invite-code storage, Row-Level Security policies, and private resume Storage policies.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for the complete installation and upgrade process.

## 2. Configure admin secrets

Add these values to `.env.local` for development or to the server-side environment settings of your deployment platform:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_SESSION_SECRET=use-a-long-random-secret
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

The Supabase service-role key bypasses Row-Level Security and must never be sent to browser code, included in client logs, or committed to Git.

Generate a strong admin session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use a unique administrator password that is not reused for Supabase, GitHub, Vercel, email, or any other service.

## 3. Understand the admin trust boundary

The `/admin` portal is more privileged than a normal application session because its server-side API routes can use the Supabase service-role client.

The portal can:

- list users and application counts
- search users
- invite new users by name/email
- generate single-use invite codes that expire after 15 minutes
- edit a user's name or email
- send password-recovery emails
- send magic links
- delete a user and application data
- remove files from that user's resume Storage folder

Invite codes are stored only as SHA-256 hashes in `public.invite_codes`. Browser roles have no direct access to that table.

Deleting a job application cascades its interview stages and lifecycle event records through the database relationships configured in `supabase/setup.sql`.

## 4. First administrator test

After deployment:

1. Open `/admin` over HTTPS.
2. Sign in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Invite a test user.
4. Complete the invitation in a separate/private browser session.
5. Verify the user can access only their own applications and resumes.
6. Test recovery and magic-link flows before inviting real users.
7. Verify deleting the test user removes the expected database/storage data.

Do not perform the first production test with irreplaceable data.

## 5. Public deployment protections

For an internet-accessible deployment:

- use HTTPS only
- use strong unique admin credentials and rotate them if exposed
- keep `/admin` out of search/navigation where it is not needed
- add platform-level access controls, WAF rules, or identity-aware proxy protection for `/admin` where practical
- add rate limiting for login/admin API endpoints if the deployment will receive significant untrusted traffic
- keep deployment logs free of secrets and service-role tokens
- restrict access to deployment environment settings
- keep database backups and test restores before schema changes

The application-level admin cookie should not be treated as a replacement for infrastructure protection on a high-value or large multi-user deployment.

## 6. Maintenance mode

The app includes a maintenance mode for planned upgrades.

Enable it with the server-side environment variable:

```env
MAINTENANCE_MODE=true
```

While maintenance mode is enabled:

- normal visitors see the maintenance page on user-facing routes
- non-admin API requests return HTTP `503 Service Unavailable`
- `/admin` and `/api/admin/*` remain available
- a browser with a valid signed admin session can bypass maintenance mode
- Next.js static assets remain available

### Test while maintenance mode is enabled

1. Sign in at `/admin` in your normal browser.
2. In that same browser, open `/jobs` or `/login`; the valid admin session can bypass maintenance mode.
3. Open the production site in an incognito/private window and confirm ordinary visitors still see maintenance mode.
4. Sign out of the admin portal and confirm the bypass disappears.

There is no query-string maintenance bypass token.

Restore normal access by setting:

```env
MAINTENANCE_MODE=false
```

or by removing the variable and redeploying.

`MAINTENANCE_MODE` is server-side and must not use the `NEXT_PUBLIC_` prefix.

## 7. Credential rotation

If an admin secret is exposed:

1. Replace `ADMIN_PASSWORD`.
2. Replace `ADMIN_SESSION_SECRET` so existing admin sessions become invalid.
3. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase if that key may have been exposed.
4. Update the deployment environment immediately.
5. Redeploy.
6. Review deployment/application logs for suspicious admin activity.

If a repository vulnerability may have exposed user data, follow [SECURITY.md](SECURITY.md) and your incident-response process rather than discussing sensitive details in a public issue.
