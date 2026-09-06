# Public Release Checklist

Use this checklist before announcing the repository or exposing a hosted instance to other users.

## 1. Licensing

The repository currently does not include an open-source license.

Before describing the project as **open source**, intentionally choose and add a `LICENSE` file that defines permitted reuse, modification, and redistribution.

A public/source-visible repository without a license does not automatically grant open-source rights.

## 2. Use the canonical setup path

Fresh deployments should use only:

- [ONE_TIME_SETUP.md](ONE_TIME_SETUP.md)
- `../supabase/setup.sql`
- `../.env.example`

Do not build a fresh deployment from SQL snippets in old commits or historical migrations.

Run the current complete:

```text
supabase/setup.sql
```

Then verify these tables exist:

```text
job_applications
application_stages
application_stage_events
invite_codes
company_logo_cache
```

Also verify:

- RLS is enabled on application, stage, event, invite-code, and company-logo cache tables as configured by the setup
- normal users can access only their own application/stage data
- lifecycle events are read-only to normal authenticated users
- invite codes are server/service-role only
- company-logo cache is server/service-role only
- the `resumes` bucket is private
- resume Storage paths are owner-scoped by authenticated user ID
- the bucket accepts only PDFs up to 5 MB

Fresh installs do not require a separate migration file.

## 3. Repository settings

Recommended GitHub settings:

- enable private vulnerability reporting if available
- enable Dependabot/security alerts where appropriate
- protect `main` from accidental force-pushes
- require pull requests for changes if multiple maintainers contribute
- add CI for `npm run lint` and `npm run build`
- never place production resumes, credentials, `.env.local`, database exports, or user data in issues/PRs

Security reports should follow [../SECURITY.md](../SECURITY.md).

## 4. Environment and secrets

Start from `.env.example` and replace every placeholder used by your deployment.

Core server-only secrets include:

```text
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Email/automation secrets may include:

```text
RESEND_API_KEY
EMAIL_UNSUBSCRIBE_SECRET
CRON_SECRET
```

AI secrets include:

```text
GROQ_API_KEY
```

Before release:

- use unique production credentials
- ensure server-only values do not use a `NEXT_PUBLIC_` prefix
- remove unused Preview/Development secrets from hosting environments
- rotate any secret ever pasted into a public issue, commit, screenshot, or log
- restrict access to Supabase, Resend, Groq, GitHub, and hosting administration

## 5. Authentication

For production:

- set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin
- configure the same origin in Supabase Site URL/allowed redirects
- remove unnecessary development redirect URLs
- test invitation flow
- test password recovery
- test magic-link sign-in
- verify old test accounts no longer have unwanted access

If using Resend SMTP for Supabase Auth, test it separately from the Job Tracker Resend API integration.

## 6. Admin portal and update email

Before exposing `/admin`:

- use strong unique admin credentials
- confirm the admin cookie has production-safe HTTP-only/secure behavior
- protect `/admin` with infrastructure controls where practical
- test user deletion with a disposable account
- verify resume cleanup
- understand that service-role-backed admin routes are privileged

If using admin update emails:

- verify the Resend sending domain
- configure `RESEND_API_KEY` and `RESEND_FROM` server-side
- configure a unique `EMAIL_UNSUBSCRIBE_SECRET`
- use **Send test** before a real send
- test All users, Selected users, and Custom emails with disposable recipients
- verify registered users who disabled product updates are excluded from product-update sends
- verify the signed unsubscribe confirmation flow

See [../ADMIN_SETUP.md](../ADMIN_SETUP.md).

## 7. AI job import

If `GROQ_API_KEY` is configured:

- verify `GROQ_IMPORT_MODEL` behavior with a normal job page
- test at least one dynamic/SPA job platform you expect users to import from
- test an Oracle Recruiting URL if Oracle support matters to the deployment
- verify extracted summaries/requirements are factual before relying on them
- confirm SSRF/private-network protections still reject local/reserved targets

Without Groq, the importer should still use supported structured metadata/fallback extraction where available.

## 8. Company logos and AI cost controls

If automatic company logos are enabled:

- verify `company_logo_cache` exists
- verify the cache is inaccessible to browser roles
- test a few common companies
- confirm repeated requests reuse cached resolution metadata
- verify `GROQ_LOGO_MODEL` uses the intended low-cost model
- verify `GROQ_LOGO_WEB_MODEL` is only reached when normal official-site discovery fails
- confirm unsafe/private network targets remain blocked

See [COMPANY_LOGOS.md](COMPANY_LOGOS.md).

## 9. AI analysis PDF and monthly automation

If analysis reports are enabled:

- configure `GROQ_ANALYSIS_MODEL`
- configure Resend API delivery
- request a manual PDF from a disposable account
- confirm the PDF attachment arrives and contains the expected application metrics
- confirm resume files, private notes, user email, and auth data are not included in the AI prompt path
- confirm the 15-minute manual report cooldown works

For monthly reports:

- configure `CRON_SECRET`
- confirm the cron route rejects invalid authorization
- confirm **Monthly analysis email** defaults off
- enable it for a disposable user and verify the preference persists
- verify duplicate user/month delivery is blocked
- confirm the cron schedule is visible in the deployed Vercel project

See [AI_ANALYSIS.md](AI_ANALYSIS.md).

## 10. Product email preferences

Registered users can independently control product/changelog email delivery.

Before release, verify:

- Account settings can turn product updates off/on
- all/selected product sends respect the opt-out
- the email unsubscribe link opens a confirmation page
- confirming the unsubscribe updates the same Supabase Auth preference
- password recovery, magic links, account/security mail, and requested analysis reports are not incorrectly blocked by the product-update preference

## 11. Application validation

Run:

```bash
npm install
npm run lint
npm run build
```

Then test at minimum:

- sign in/sign out
- invitation redemption
- create/edit/delete application
- Applied ↔ Bookmarked status/lifecycle behavior
- lifecycle stage creation/transitions
- rejection at a stage
- resume upload/download/replacement
- application deletion with resume cleanup
- delete-all data flow
- CSV export
- job import
- company logos
- Account settings toggles
- manual analysis PDF
- maintenance mode

## 12. Production controls

For an internet-facing deployment:

- serve over HTTPS
- keep platform/application logs free of secrets and personal data
- add rate limiting/WAF controls if traffic warrants it
- monitor authentication/admin failures
- keep database backups and document restore procedures
- restrict Supabase/hosting administrator access
- keep dependencies updated

## 13. Vercel deployment behavior

The repository intentionally disables automatic Git deployments in `vercel.json`:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

A merge/push will therefore not automatically publish the code. After validating a release, trigger a manual Production deployment in Vercel.

Do not assume a merged PR is live until the manual production deployment completes.

## 14. Privacy and data handling

Resumes and job-search notes can contain sensitive personal information.

Before inviting users:

- decide who operates the service and who can access infrastructure-level data
- document retention/deletion expectations if the instance is shared
- verify account deletion behavior
- avoid production resumes/user data in security tests or bug reports
- understand which public job/company metadata is sent to Groq for enabled AI features

## 15. Release notes

A public release announcement should state:

- whether the repository is open source or only source-visible
- expected deployment audience
- that Supabase setup is required
- that Groq/Resend features are optional/configurable
- that automatic Vercel Git deployments are disabled by repository configuration
- known operational limitations
- where to report vulnerabilities privately

Do not advertise guarantees beyond what has actually been tested and deployed.
