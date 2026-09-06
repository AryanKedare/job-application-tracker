# Security Policy

Security issues should be reported privately so maintainers can investigate and prepare a fix before technical details are made public.

## Supported code

Security fixes target the current `main` branch and the latest deployed release. Historical commits and unsupported forks may not receive fixes.

## Reporting a vulnerability

Do **not** open a public GitHub issue containing exploit details, credentials, personal data, private resume links, service-role keys, admin secrets, Resend/Groq keys, cron secrets, or reproduction steps for an unpatched vulnerability.

Preferred reporting path:

1. Use GitHub private vulnerability reporting / a private Security Advisory if enabled.
2. Otherwise contact the repository owner through a private contact method listed on their GitHub profile and ask for a secure reporting channel.

Include, where possible:

- affected route, component, SQL policy, or deployment configuration
- impact and affected data
- reproducible steps using disposable test data
- whether authentication is required
- relevant request/response details with secrets removed
- suggested mitigation, if known

Do not include real user resumes, authentication tokens, service-role keys, admin credentials, unsubscribe tokens/secrets, cron secrets, API keys, or production database exports.

## High-impact areas

Treat reports involving these areas as sensitive:

- Supabase service-role exposure
- Row-Level Security bypasses
- cross-user application/lifecycle access
- private resume or signed-URL bypasses
- admin authentication/session bypasses
- invitation/account-takeover flaws
- SSRF/private-network access through job import or company-logo resolution
- stored/reflected script injection
- destructive data-deletion behavior
- forged product-update unsubscribe links
- unauthorized cron/monthly-analysis execution
- exposure of Resend or Groq API keys
- AI prompt paths leaking resumes, notes, email addresses, tokens, or unrelated private data
- secrets committed to repository history

## Canonical database/storage setup

Fresh and upgraded deployments should use the current:

```text
supabase/setup.sql
```

The canonical setup configures:

- owner-scoped application/stage RLS
- read-only lifecycle history for normal authenticated users
- server-only invite-code access
- server-only company-logo cache access
- private resume Storage
- owner-scoped resume policies
- lifecycle/status trigger functions

Fresh deployments should not assemble schema/security state from historical migration snippets.

## Deployment security responsibilities

Application-level controls do not replace secure infrastructure configuration.

For an internet-accessible instance:

- use HTTPS
- keep server-only environment variables out of browser bundles/logs
- use strong unique admin credentials
- restrict access to deployment/Supabase/Resend/Groq administration
- keep the `resumes` bucket private
- apply the current `supabase/setup.sql`
- configure exact Supabase Auth redirect URLs
- add platform-level rate limiting/WAF controls where appropriate
- protect `/admin` at the infrastructure layer where practical
- maintain database backups and test restore procedures
- manually validate a production deployment before inviting users

## Public vs server-only configuration

Browser-visible Supabase values are expected to use:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Server-only values include:

```text
SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
RESEND_API_KEY
EMAIL_UNSUBSCRIBE_SECRET
CRON_SECRET
GROQ_API_KEY
```

Do not add a `NEXT_PUBLIC_` prefix to server-only secrets.

`NEXT_PUBLIC_ACCESS_REQUEST_EMAIL`, when configured, is intentionally public because it is used by the browser to create an access-request mail draft.

## Admin trust boundary

`/api/admin/*` routes may use the Supabase service role after application-level admin authentication. Compromise of the admin session/credentials can therefore have broader impact than compromise of a normal user session.

Operators should:

- use unique admin credentials
- rotate `ADMIN_SESSION_SECRET` after suspected compromise
- add infrastructure protection to `/admin` where practical
- avoid logging admin request bodies containing sensitive values
- test destructive admin operations only on disposable accounts first

## Resume security

Resumes are stored in the private `resumes` bucket under owner-scoped paths such as:

```text
<user-id>/<uuid>.pdf
```

The database stores bucket-relative object paths, not public resume URLs. The application creates short-lived signed URLs only for the authenticated owner.

Production deployments should verify that a user cannot read another user's resume object path.

## Outbound network security

Job import and company-logo discovery accept or derive external URLs. These routes must treat every network target as untrusted.

The current design includes controls such as:

- protocol restrictions
- DNS resolution before connection
- private/reserved IP rejection
- request pinning to vetted addresses
- redirect re-validation/restriction
- timeout/response-size limits
- content/image validation

AI-resolved domains/URLs are not trusted merely because the model returned them.

## AI privacy boundaries

### Job import

The job importer processes the public job-posting content the user asks it to import. Page content is treated as untrusted data and should not be allowed to override system extraction instructions.

### Company logos

Logo AI should receive only public company-resolution context such as company name and inferred official domain. It should not receive resumes, private notes, user email, or auth tokens.

### Application analysis

The analysis model receives bounded pipeline metadata and deterministic metrics. It should not receive:

- resume files or paths
- full saved job-description text
- private notes
- user email address
- passwords
- auth tokens
- admin/service credentials

The recipient address is used by the server only for Resend delivery after the report is generated.

## Email and unsubscribe security

Admin product/update mail and AI reports use the server-side Resend API.

Registered-user product emails can include a signed unsubscribe link. The signing secret is `EMAIL_UNSUBSCRIBE_SECRET`; links open a confirmation page before changing the preference so ordinary email-link scanners do not unsubscribe users just by fetching a URL.

Rotating the signing secret invalidates existing unsubscribe links.

Authentication emails such as password recovery and magic links remain separate from the product-update preference.

## Cron security

Month-end analysis uses a Vercel Cron route protected by:

```text
CRON_SECRET
```

The route requires exact bearer authorization and should not execute monthly reports if the secret is missing or incorrect.

Monthly analysis is opt-in per user and de-duplicated by user/month.

## Secret exposure

If a credential is accidentally committed or exposed, deleting it from the latest file is not sufficient. Rotate it immediately and review repository/deployment history for further exposure.

Potentially affected secrets include:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `RESEND_API_KEY`
- `EMAIL_UNSUBSCRIBE_SECRET`
- `CRON_SECRET`
- `GROQ_API_KEY`

If `ADMIN_SESSION_SECRET` is rotated, existing admin sessions are invalidated. If `EMAIL_UNSUBSCRIBE_SECRET` is rotated, existing unsubscribe links stop validating. Rotate service/provider keys in their respective platforms and update all live deployments.

## Deployment note

Automatic Vercel Git deployments are disabled in `vercel.json`. A merged security fix is not necessarily live until the operator performs a manual Production deployment.

After applying a security fix, verify the deployed production commit/version explicitly.

## Disclosure

Please allow reasonable time for investigation and remediation before public disclosure. Once a fix is deployed, maintainers can coordinate release notes and appropriate technical detail without exposing user secrets or private data.
