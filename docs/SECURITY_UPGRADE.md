# Security upgrade, September 2026

This release addresses the five findings in the September 15–16 security review.
Code changes alone do not activate the database policies or change Supabase Auth settings.

## Rollout order

1. Back up the database and use maintenance mode during the upgrade.
2. In Supabase Auth, **disable Allow new users to sign up**. Existing users can still sign in; the service-role invitation API remains the onboarding path.
3. Run the complete current `supabase/setup.sql`. It is idempotent and preserves application data. Refresh the PostgREST schema cache if necessary.
4. Review existing account membership before reopening the site. Setup approves only users with Auth-managed `invited_at`; user-editable `invited_by_admin` and `invited_by_code` flags never grant access. Accounts originally created through another trusted process require individual administrator approval. Review their identity and invitation history, then use SQL Editor with their verified ID:

   ```sql
   insert into public.app_memberships(user_id)
   values ('VERIFIED-USER-UUID')
   on conflict (user_id) do nothing;
   ```

   Do not bulk approve all Auth users or set a `deleting` membership back to active while deletion is in progress.
5. Deploy the updated application and lockfile. Required server variables include `SUPABASE_SERVICE_ROLE_KEY`. Missing tables/RPCs block protected work; there is no in-memory fallback.
6. If your proxy guarantees it overwrites a single-IP header, configure `TRUSTED_CLIENT_IP_HEADER` to that header's name. Otherwise leave it blank: the shared account/global limits still apply and clients share an `unknown` IP bucket. Do not trust client-supplied forwarding headers. Verify proxy behavior at the deployed edge before enabling this option.
7. Complete staging checks below, then reopen the site. Automatic Vercel Git deployments remain disabled; deployment is a separate manual operation.

## Controls and default limits

| Operation | Per account | Shared limit |
| --- | --- | --- |
| Admin login, including successful attempts | 5/minute and 20/hour for the configured admin account; 5/15 minutes per trusted IP | All workers use the same atomic database counters |
| Job import | 6/minute, 40/day per member | 1,000 AI operations/day across all features/users |
| Company icon lookup | 60/minute, 200/day per member, regardless of company text | Same AI budget |
| Analysis | 1/minute, 6/day; an atomic reservation enforces at least 15 minutes between attempts | Same AI budget; monthly reports reserve one unique user/month |
| Concurrent AI work | 3 requests/member | 12 requests across workers |
| Optional access-request lookup | 5/minute per trusted IP | 30/minute |

These are request budgets, not exact currency accounting. Each JSON AI request tries at most two models with at most 1,800 output tokens each; web logo lookup uses at most 1,024 output tokens. Logo operations may call both model paths. Set spending limits with the AI provider as well, especially when changing model pricing or enabling web tools. Windows start with the first accepted request and do not slide when a blocked request arrives.

Reservations are consumed before external work, including failed attempts. Work leases expire after 15 minutes if a worker crashes; routes have bounded platform execution durations. Successful requests release leases immediately. Shared budgets and concurrency checks are enforced in one database transaction. Client roles cannot call protection RPCs or mutate membership, counters, leases, or report jobs.

Analysis jobs retain `started`, `sent`, or `failed` state. Automatic retries never regenerate the same monthly reservation. A manual attempt can retry after the 15-minute cooldown and within its daily quota. If delivery or completion persistence fails, an email may already have been sent. Inspect provider delivery logs and `analysis_report_jobs` before manually resetting a failed/abandoned monthly reservation. Never delete reservations while work may still be running. Metadata write errors are reported, not silently ignored.

Memory logo caches hold at most 500 entries each. Persistent logo metadata is trimmed to 5,000 entries. Expired rate buckets and work leases are cleaned during reservations. Keep an eye on 429/503 responses, the `Security request limit reached` server log, report failures, provider spend, and database growth. This application does not configure an external alerting service.

## Account deletion

Deletion first sets membership to `deleting`, blocking database/storage access and paid APIs even for existing sessions. It repeatedly deletes page zero, including nested resume folders, and verifies an empty listing. Storage errors and safety limits stop deletion. Retrying the admin deletion resumes cleanup. Application data is retained until Auth deletion succeeds and its foreign-key cascades remove the rows. In-flight uploads that began before revocation can still cause Auth deletion to fail; retry once they settle. Success is returned only after Auth confirms deletion.

## Browser and dependency changes

Next.js and its ESLint configuration are updated to 16.3.5, React to 19.3.0, and the lockfile is rebuilt. The unused image optimizer is disabled, removing the wildcard Supabase image decoder surface. Page CSP uses unpredictable request nonces and dynamic rendering. Page HTML must remain uncached at the CDN; inline styles remain allowed for existing UI components. The optional access-request flow still intentionally reveals account existence and remains disabled by default.

## Validation

```sh
npm ci
npm audit --audit-level=low
npm run lint
npm test
npm run build
```

The tests execute the complete SQL twice in embedded PostgreSQL with stubbed Supabase platform schemas. They verify RLS, permissions, membership, limits, cooldowns, and reservations. Handler tests run isolated workers against the shared test database with external HTTP, AI, storage, and email mocked. They cover admin bursts, quota bypass attempts, duplicate analysis generation, persistence failures, storage pagination/nesting, deletion retries, and CSP. Embedded PostgreSQL serializes connections, so staging still needs real concurrent database connections and actual Supabase storage/auth behavior.

In staging, verify:

- Direct signup with a disposable address and the public anon key is rejected by Supabase. An unapproved existing account also cannot write rows, upload resumes, or use paid endpoints, even after editing its metadata.
- Fresh email invitations, code invitations (including an existing account), password recovery, and approved-user sign-in work.
- Concurrent admin guesses receive 429 with Retry-After, including varied client-supplied forwarding headers; missing protection storage returns 503.
- Simultaneous requests hitting different workers obey user/global quotas and generate one report. Test failure recovery and monthly deduplication without paid production calls.
- Deleting a disposable account with more than 100 resumes and nested paths removes all storage objects before Auth deletion. Force a storage failure and verify a retry completes.
- CSP permits hydration, internal navigation, auth redirects, dialogs, and editor interactions. Injected inline scripts without the response nonce are blocked; page nonces change on reload.

No production database changes, email deliveries, provider charges, or deployment are performed by the test suite.
