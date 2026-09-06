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

## 3. Configure Resend admin update emails

Password-recovery and magic-link emails can continue to use your existing Supabase Auth + Resend SMTP configuration. The admin update-email composer is separate: it calls the Resend API server-side.

Supabase Auth remains the source of truth for Job Tracker users. The application does **not** copy users into Resend Contacts or Segments and does not require a Resend Segment ID. Resend is used only as the mail-delivery transport for these admin updates.

In Resend:

1. Keep your sending domain verified.
2. Create a sending API key for this deployment. A domain-scoped sending key is preferred when your Resend account supports that configuration; Contacts/Segments permissions are not required by this feature.
3. Choose a sender address on the verified domain, for example `Job Tracker <updates@your-domain.example>`.

Add the following server-only deployment variables:

```env
RESEND_API_KEY=
RESEND_FROM=
EMAIL_UNSUBSCRIBE_SECRET=
```

`EMAIL_UNSUBSCRIBE_SECRET` signs the account-specific unsubscribe links included in product-update emails. Use at least 32 random characters. A convenient generator is:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Do not prefix any of these values with `NEXT_PUBLIC_`, and do not commit production values to Git.

### Recipient modes

The admin dashboard provides three recipient modes:

- **All users** — the server reads all confirmed Supabase Auth users and sends directly to their current account addresses.
- **Selected users** — the administrator selects confirmed Job Tracker users; the server resolves those user IDs against Supabase Auth before sending.
- **Custom emails** — the administrator enters one-off addresses. These addresses are not added to Supabase Auth or to a Resend audience.

All three modes use Resend Batch Email for delivery. Messages are sent individually rather than exposing recipients through To/CC/BCC lists. Direct sends are chunked into batches of at most 100 messages per Resend request.

The current application-side limits are:

- up to 10,000 confirmed users when **All users** is selected
- up to 1,000 recipients for **Selected users** or **Custom emails**

The composer also provides:

- a subject field
- a message field
- an optional HTTPS call-to-action button
- **Send test**, which sends the rendered template only to `ADMIN_EMAIL`
- a confirmation step before every real send
- the number of recipients accepted for delivery

### Product-update preferences

Registered Job Tracker users control product/changelog email delivery through the Supabase Auth metadata key:

```text
email_updates_enabled
```

A missing value is treated as enabled, so existing users require no backfill. When a user turns updates off, the app stores `email_updates_enabled: false` in that user's Supabase Auth `user_metadata`. Turning updates back on stores `true`.

Users can change the preference from **Applications → Account settings → Email preferences**. Product-update sends to **All users** and **Selected users** automatically exclude accounts where the preference is `false`.

Each registered-user product email also contains a signed **Unsubscribe from product updates** link. The link opens `/email/unsubscribe` and requires an explicit confirmation before changing the preference, so ordinary email-link scanners do not unsubscribe the user merely by fetching the URL. Confirming the action writes the same `email_updates_enabled: false` metadata used by Account settings.

Custom email addresses are one-off direct recipients and do not have a Job Tracker account preference. Authentication, password-recovery, magic-link, and important account/security emails remain separate from the product-update preference.

## 4. Understand the admin trust boundary

The `/admin` portal is more privileged than a normal application session because its server-side API routes can use the Supabase service-role client.

The portal can:

- list users and application counts
- search users
- invite new users by name/email
- generate single-use invite codes that expire after 15 minutes
- edit a user's name or email
- send password-recovery emails
- send magic links
- send a test update email through Resend
- send update emails to all confirmed users, selected users, or custom addresses
- delete a user and application data
- remove files from that user's resume Storage folder

Invite codes are stored only as SHA-256 hashes in `public.invite_codes`. Browser roles have no direct access to that table.

Deleting a job application cascades its interview stages and lifecycle event records through the database relationships configured in `supabase/setup.sql`.

## 5. First administrator test

After deployment:

1. Open `/admin` over HTTPS.
2. Sign in using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Invite a test user.
4. Complete the invitation in a separate/private browser session.
5. Verify the user can access only their own applications and resumes.
6. Test recovery and magic-link flows before inviting real users.
7. Configure the Resend variables and `EMAIL_UNSUBSCRIBE_SECRET`, compose a harmless update, and use **Send test** first.
8. Confirm the sender/domain/template render correctly.
9. Open the test user's Account settings, turn product updates off, and confirm an **All users** or **Selected users** send excludes that account.
10. Turn the preference back on, send a test product update to that account, open its unsubscribe link, confirm the opt-out, and verify Account settings now shows product updates off.
11. Verify deleting the test user removes the expected database/storage data.

Do not perform the first production test with irreplaceable data or a real audience.

## 6. Public deployment protections

For an internet-accessible deployment:

- use HTTPS only
- use strong unique admin credentials and rotate them if exposed
- keep `/admin` out of search/navigation where it is not needed
- add platform-level access controls, WAF rules, or identity-aware proxy protection for `/admin` where practical
- add rate limiting for login/admin API endpoints if the deployment will receive significant untrusted traffic
- keep deployment logs free of secrets, service-role tokens, Resend API keys, and unsubscribe signing secrets
- restrict access to deployment environment settings
- keep database backups and test restores before schema changes
- always send a test email before sending a production update
- keep product/changelog mail separate from essential authentication and account-security messages

The application-level admin cookie should not be treated as a replacement for infrastructure protection on a high-value or large multi-user deployment.

## 7. Maintenance mode

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

## 8. Credential rotation

If an admin secret is exposed:

1. Replace `ADMIN_PASSWORD`.
2. Replace `ADMIN_SESSION_SECRET` so existing admin sessions become invalid.
3. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase if that key may have been exposed.
4. Rotate `RESEND_API_KEY` if that key may have been exposed.
5. Rotate `EMAIL_UNSUBSCRIBE_SECRET` if unsubscribe tokens may have been exposed; old unsubscribe links will become invalid after rotation.
6. Update the deployment environment immediately.
7. Redeploy.
8. Review deployment/application logs for suspicious admin activity.

If a repository vulnerability may have exposed user data, follow [SECURITY.md](SECURITY.md) and your incident-response process rather than discussing sensitive details in a public issue.
