# Security Policy

Security issues should be reported privately so maintainers have an opportunity to investigate and prepare a fix before technical details are made public.

## Supported code

Security fixes target the current `main` branch and the latest deployed release. Historical commits and unsupported forks may not receive fixes.

## Reporting a vulnerability

Do **not** open a public GitHub issue containing exploit details, credentials, personal data, private resume links, service-role keys, or reproduction steps for an unpatched vulnerability.

Preferred reporting path:

1. Use GitHub private vulnerability reporting / a private Security Advisory for this repository if that feature is enabled.
2. If private vulnerability reporting is not available, contact the repository owner through a private contact method listed on their GitHub profile and ask for a secure reporting channel.

Include, where possible:

- affected route, component, SQL policy, or deployment configuration
- impact and affected data
- reproducible steps using test data
- whether authentication is required
- relevant request/response details with secrets removed
- suggested mitigation, if known

Do not include real user resumes, authentication tokens, service-role keys, admin credentials, or production database exports in a report.

## High-impact areas

Reports involving the following should be treated as sensitive:

- Supabase service-role exposure
- Row-Level Security bypasses
- cross-user application/resume access
- signed resume URL or private Storage bypasses
- admin authentication/session bypasses
- invitation or account-takeover flaws
- SSRF/private-network access through job import
- stored or reflected script injection
- destructive data-deletion behavior
- secrets committed to repository history

## Deployment security responsibilities

This project provides application-level controls, but operators remain responsible for their deployment environment.

For an internet-accessible instance:

- use HTTPS
- keep server-only environment variables out of browser bundles and logs
- use strong unique admin credentials
- restrict access to deployment/Supabase administration
- keep the `resumes` bucket private
- apply the current `supabase/setup.sql`
- configure exact authentication redirect URLs
- add platform-level rate limiting/WAF controls when appropriate
- protect `/admin` at the infrastructure layer where practical
- maintain database backups and test restore procedures

## Secret exposure

If a credential is accidentally committed or exposed, deleting it from the latest file is not sufficient. Rotate the affected credential immediately and review repository/deployment history for further exposure.

Potentially affected secrets include:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `GROQ_API_KEY`

If `ADMIN_SESSION_SECRET` is rotated, existing admin sessions are invalidated. If the Supabase service-role key may have been exposed, rotate it in Supabase and update every deployment that uses it.

## Disclosure

Please allow reasonable time for investigation and remediation before public disclosure. Once a fix is available, maintainers can coordinate release notes and appropriate technical details without exposing user secrets or private data.
