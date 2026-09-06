# Admin Portal Setup

The admin portal is available at `/admin` and uses server-only environment credentials plus a signed HTTP-only admin session cookie.

This admin model is intentionally simple and is best suited to personal or small-team deployments. For an internet-facing deployment, add infrastructure-level protection around `/admin` where practical.

## Prerequisite

Complete the canonical one-time setup first:

- [docs/ONE_TIME_SETUP.md](docs/ONE_TIME_SETUP.md)
- `supabase/setup.sql`

The canonical SQL creates the application/lifecycle tables, invite-code storage, company-logo cache, Row-Level Security policies, lifecycle triggers, and private resume Storage configuration. Fresh installations do not require separate migration files.

## Admin secrets

Configure these server-side values:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_SESSION_SECRET=use-a-long-random-secret
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

The application also requires the normal Supabase public configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Never use a `NEXT_PUBLIC_` prefix for the admin password, session secret, or service-role key.

Generate a strong session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use a unique administrator password that is not reused for Supabase, GitHub, Vercel, email, or another service.

## What the admin portal can do

The service-role-backed admin routes can:

- list/search users and application counts
- invite users
- generate single-use invite codes
- edit user profile/name/email fields supported by the app
- send password-recovery emails
- send magic links
- send product/site update emails
- send a test update email before a real audience send
- target all confirmed users, selected users, or custom email addresses
- delete users and their application/resume data

Because the admin API uses the Supabase service role, `/admin` is a privileged trust boundary.

## Invite codes

Invite codes are stored as SHA-256 hashes in `public.invite_codes` and are accessible only through server-side service-role operations. Browser roles have no direct table access.

## Resend application email

Supabase Auth email and Job Tracker application email are separate concerns:

- password recovery / magic links / invitations can continue to use Supabase Auth email or Supabase + Resend SMTP
- admin product/update mail and analysis PDFs use the Resend API directly from Job Tracker server routes

Configure:

```env
RESEND_API_KEY=re_...
RESEND_FROM=Job Tracker <updates@your-domain.example>
EMAIL_UNSUBSCRIBE_SECRET=replace-with-a-long-random-secret
```

No Resend Contacts or Segment configuration is required. Supabase Auth remains the source of truth for Job Tracker users.

### Recipient modes

The update composer supports:

- **All users** — current confirmed Supabase Auth users
- **Selected users** — specific registered users selected by the administrator
- **Custom emails** — one-off addresses entered manually

Selected/all-user recipients are resolved server-side. Custom addresses are not added to Supabase Auth or to a mailing-list database.

Direct sends use Resend's individual/batch email APIs so recipients are not exposed to one another through CC/BCC.

## Product-update preferences

Registered users control product/changelog email delivery through Supabase Auth `user_metadata`:

```text
email_updates_enabled
```

Missing value means enabled for existing accounts. Setting the preference to `false` excludes that registered user from product-update sends to **All users** and **Selected users**.

Users can change the setting from **Account settings → Email preferences**.

Registered-user product emails include a signed **Unsubscribe from product updates** link. The link opens a confirmation page before changing the preference so ordinary link scanners do not opt the user out merely by fetching the URL.

The signing key is:

```env
EMAIL_UNSUBSCRIBE_SECRET=...
```

Password recovery, magic links, invitations, security/account messages, and explicitly requested analysis reports do not depend on the product-update preference.

## AI analysis email

Users can request **Application insights PDF** from Account settings. The server generates the report using the configured Groq analysis model, creates the PDF server-side, and sends it to the confirmed account address through Resend.

Users can independently opt in to **Monthly analysis email**. This is off by default and does not share the product-update preference.

Monthly automation also requires:

```env
CRON_SECRET=replace-with-a-long-random-secret
```

See [docs/AI_ANALYSIS.md](docs/AI_ANALYSIS.md) for model/privacy/automation details.

## First administrator test

After deployment:

1. Open `/admin` over HTTPS.
2. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Invite a disposable test user.
4. Complete the invitation in a separate/private browser session.
5. Verify the user can access only their own applications and resumes.
6. Test password recovery and magic-link flows.
7. Configure Resend and use **Send test** before any real update send.
8. Test **All users**, **Selected users**, and **Custom emails** with disposable recipients.
9. Turn product updates off in the test user's Account settings and verify product-update sends exclude that account.
10. Re-enable the preference, send a product update, and test the signed unsubscribe confirmation flow.
11. Request an AI analysis PDF from the test account if Groq/Resend are enabled.
12. Toggle monthly analysis on/off and verify the preference persists.
13. Delete the disposable user and verify application/resume cleanup.

Do not perform the first production validation using irreplaceable data or a real audience.

## Maintenance mode

Enable maintenance mode with:

```env
MAINTENANCE_MODE=true
```

While enabled, normal user-facing traffic is placed into maintenance behavior while admin routes remain available according to the application middleware.

Restore normal access with:

```env
MAINTENANCE_MODE=false
```

This variable is server-side and must not use a `NEXT_PUBLIC_` prefix.

## Vercel deployments

Automatic Git deployments are disabled in `vercel.json`.

After changing admin credentials, Resend/Groq configuration, cron configuration, or application code, trigger a manual Production deployment in Vercel when you are ready to publish the change.

## Credential rotation

If a secret is exposed:

1. rotate the affected secret immediately
2. replace `ADMIN_SESSION_SECRET` if admin sessions should be invalidated
3. rotate `SUPABASE_SERVICE_ROLE_KEY` if it may have been exposed
4. rotate `RESEND_API_KEY` if it may have been exposed
5. rotate `EMAIL_UNSUBSCRIBE_SECRET` if unsubscribe signing is affected; old links will stop validating
6. rotate `CRON_SECRET` if cron authorization is affected
7. rotate `GROQ_API_KEY` if it may have been exposed
8. update deployment environment values
9. manually redeploy
10. review relevant logs for suspicious activity

For vulnerability reporting and broader security guidance, see [SECURITY.md](SECURITY.md).
