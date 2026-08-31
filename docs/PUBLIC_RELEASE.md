# Public Release Checklist

Use this checklist before announcing the repository or a hosted instance publicly.

## 1. Licensing

The repository currently does not include an open-source license.

Before describing the project as **open source**, choose and add a `LICENSE` file that reflects how you want others to use, modify, and redistribute the code.

Publishing a repository without a license makes the source visible, but does not automatically grant open-source reuse rights.

## 2. Repository settings

Recommended GitHub settings for a public release:

- enable private vulnerability reporting if available
- enable Dependabot/security alerts where appropriate
- protect `main` from accidental force-pushes
- require pull requests for changes if multiple maintainers contribute
- add CI for `npm run lint` and `npm run build`
- avoid storing production exports, resumes, credentials, or `.env.local` files in issues or pull requests

Security reports should follow [../SECURITY.md](../SECURITY.md).

## 3. Environment and secrets

Start from the committed `.env.example` and replace all placeholders.

Before release:

- use a unique `ADMIN_PASSWORD`
- generate a random `ADMIN_SESSION_SECRET`
- verify `SUPABASE_SERVICE_ROLE_KEY` exists only in server-side environment settings
- verify `GROQ_API_KEY`, if used, is server-side only
- remove unused Preview/Development secrets from hosting environments
- rotate any secret that has ever been pasted into a public issue, commit, screenshot, or log

## 4. Database and Storage

Run the current complete:

```text
supabase/setup.sql
```

Then verify:

- `job_applications`, `application_stages`, `application_stage_events`, and `invite_codes` exist
- RLS is enabled on application/stage/history tables
- normal users can access only their own application data
- lifecycle events are read-only to normal authenticated users
- the `resumes` bucket is private
- resume Storage policies restrict paths to the authenticated user's top-level folder
- invite-code storage is unavailable to `anon` and normal authenticated clients

Fresh installs should not require the dated legacy hardening migration.

## 5. Authentication

For production:

- set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin
- configure Supabase Site URL and allowed redirect URLs for that origin
- remove unnecessary development redirect URLs
- test invitation email flow
- test password recovery
- test magic-link sign-in
- ensure old test accounts do not have access they should not retain

## 6. Admin portal

Before exposing `/admin`:

- verify admin credentials are not defaults or reused passwords
- verify the admin session cookie is HTTP-only/secure in production behavior
- protect `/admin` with infrastructure controls where practical
- test user deletion using a disposable account
- verify resume files are removed as expected during data deletion
- understand that the service-role-backed admin API is a privileged trust boundary

See [../ADMIN_SETUP.md](../ADMIN_SETUP.md).

## 7. Application validation

Run locally or in CI:

```bash
npm install
npm run lint
npm run build
```

Then test at minimum:

- sign in/sign out
- invitation redemption
- create/edit/delete application
- lifecycle stage creation and transitions
- rejection at a stage
- resume upload
- signed resume download
- resume replacement
- application deletion with resume cleanup
- delete-all data flow
- CSV export
- job import with a normal public URL
- blocked job import to private/local network targets
- maintenance mode

## 8. Production controls

For a public internet deployment:

- serve the site over HTTPS
- enable hosting/platform logs without logging secrets
- add rate limiting/WAF controls if untrusted traffic volume warrants it
- monitor authentication/admin failures
- keep database backups
- document how to restore from backup
- restrict Supabase and deployment-platform administrator access
- keep dependencies updated

## 9. Privacy and data handling

Resumes and job-search notes may contain sensitive personal information.

Before inviting other users:

- decide who operates the service and who can access infrastructure-level data
- document your retention/deletion expectations if the instance is shared
- verify account deletion behaves as expected
- avoid using production resumes when testing security or bug reports

## 10. Release notes

A public release announcement should clearly state:

- whether the repository is open source or merely source-visible
- expected deployment audience (personal/small-team)
- required Supabase setup
- optional Groq dependency
- known operational limitations
- where to report security vulnerabilities privately

Do not advertise security guarantees beyond what has actually been tested and deployed.
