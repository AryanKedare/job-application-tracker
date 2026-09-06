# AI Models, Analysis Reports, and Cost Controls

Job Tracker uses Groq for several different tasks. Each task has its own model setting so simple company-domain resolution does not need the same model as long-form job extraction or detailed application analysis.

## Model split

```env
GROQ_API_KEY=

GROQ_MODEL=openai/gpt-oss-20b
GROQ_IMPORT_MODEL=openai/gpt-oss-20b
GROQ_LOGO_MODEL=llama-3.1-8b-instant
GROQ_LOGO_WEB_MODEL=groq/compound-mini
GROQ_ANALYSIS_MODEL=openai/gpt-oss-20b
```

Purpose:

- `GROQ_MODEL` — general fallback
- `GROQ_IMPORT_MODEL` — Add Job / job-description extraction
- `GROQ_LOGO_MODEL` — low-cost company-name → official-domain resolution
- `GROQ_LOGO_WEB_MODEL` — last-resort web-search logo discovery
- `GROQ_ANALYSIS_MODEL` — manual and month-end application analysis

The task-specific variables are optional because the application has defaults/fallbacks, but explicitly defining them makes production behavior easier to audit and change independently.

## Add Job / job-description extraction

When a user imports a job URL, Job Tracker first attempts to collect factual source data without relying on AI alone:

1. fetch the public job page using restricted outbound networking
2. inspect JSON-LD `JobPosting` data
3. inspect useful metadata
4. preserve relevant embedded SPA/JSON payloads
5. use supported platform-specific APIs such as Oracle Recruiting where available
6. send the bounded extracted text to `GROQ_IMPORT_MODEL` for structured normalization

The model is asked to return:

- job title
- company
- location
- source
- summary
- responsibilities
- required qualifications
- preferred skills

The importer caps AI input and treats the job page as untrusted data. Instructions embedded in the page are not trusted as application instructions.

`openai/gpt-oss-20b` is the default import model because the task benefits from reliable long-text parsing and structured JSON while remaining substantially cheaper than very large reasoning models.

## Company-logo cost controls

Company logos use a separate low-cost path:

```text
persistent company_logo_cache
        ↓ miss
GROQ_LOGO_MODEL
        ↓
official-site favicon/logo discovery
        ↓ only if needed
GROQ_LOGO_WEB_MODEL
```

The persistent cache is created by the canonical:

```text
supabase/setup.sql
```

Fresh installations do not need a separate cache migration. Existing installations should re-run the canonical setup once.

Positive company-resolution results are cached for about 30 days and negative AI resolutions for about 12 hours, reducing repeated AI spend across Vercel cold starts.

See [COMPANY_LOGOS.md](COMPANY_LOGOS.md) for the complete lookup/security flow.

## Manual application analysis PDF

A signed-in user can open:

```text
Account settings → AI analysis → Application insights PDF → Email PDF
```

The server:

1. verifies the current Supabase access token
2. loads only that user's application/lifecycle data
3. calculates deterministic pipeline metrics
4. sends a compact pipeline snapshot to `GROQ_ANALYSIS_MODEL`
5. validates the structured AI response
6. generates the PDF server-side
7. emails the PDF to the user's confirmed account address through Resend

The report can include:

- total/status breakdown
- recent activity
- interview activity
- offer indicators
- stale applications
- source performance
- rejection-stage signals
- strengths
- bottlenecks
- observed patterns
- practical recommendations
- a next-seven-days action plan

Manual reports have a 15-minute per-user cooldown and use Resend idempotency protection.

## Month-end automatic analysis

Users can independently opt in from:

```text
Account settings → AI analysis → Monthly analysis email
```

The preference is stored in Supabase Auth `user_metadata`:

```text
monthly_analysis_enabled
```

It defaults to off because recurring AI/email spend should require explicit user choice.

### Vercel Cron

`vercel.json` schedules:

```text
0 18 28-31 * *
```

for:

```text
/api/cron/monthly-analysis
```

The route is called on days 28-31 at 18:00 UTC but sends only when the current UTC date is the actual final day of the month.

Configure:

```env
CRON_SECRET=replace-with-a-long-random-secret
```

The cron endpoint requires Vercel-style bearer authorization using that secret.

For each run, the server:

1. lists Supabase Auth users server-side
2. selects only confirmed users with `monthly_analysis_enabled: true`
3. skips users already sent the current period
4. generates reports with bounded concurrency
5. sends one PDF per eligible user
6. de-duplicates email delivery with a user/month idempotency key
7. records `monthly_analysis_last_period` and timestamps in protected Supabase Auth `app_metadata`

The product/changelog email preference is separate from monthly analysis. A user may disable product updates while leaving monthly analysis enabled, or the reverse.

## Shared report service

Manual and month-end reports use the same server-side report service for:

- application/stage loading
- deterministic metrics
- AI prompt/response validation
- PDF generation
- Resend delivery
- metadata updates

This avoids separate report implementations drifting apart.

## Privacy

The analysis model receives only pipeline data needed for the report, including fields such as:

- company
- job title
- application status
- source
- location
- application dates
- lifecycle stage names/states/timestamps used by the snapshot
- deterministic metrics calculated from those records

The analysis request does **not** send:

- user email address
- resume PDFs
- resume storage paths
- full saved job-description text
- private notes
- passwords
- Supabase access tokens
- admin credentials

The recipient email address is used only by the server when delivering the already-generated PDF through Resend.

Job import is different: it necessarily processes the public job-posting content being imported.

## Cost controls

- logo lookup uses a small model first
- logo web search is a last resort
- logo/company metadata is persisted in Supabase cache
- job import has its own model and bounded input
- manual analysis only runs after an explicit user action
- recurring analysis is off by default
- analysis prompts include only the bounded recent application sample used by the snapshot implementation
- manual reports have a cooldown
- month-end delivery is de-duplicated by user/month
- Resend idempotency protects duplicate delivery

## Email requirements

Analysis PDFs use the same server-side Resend transport as admin update emails:

```env
RESEND_API_KEY=
RESEND_FROM=Job Tracker <updates@your-domain.example>
```

Resend Contacts/Segments are not required.

## Deployment behavior

Automatic Vercel Git deployments are disabled by repository configuration. After changing model settings, cron configuration, report code, or environment variables, trigger a manual Production deployment when ready.

The month-end cron only exists in production after a deployment containing the current `vercel.json` is live.

## Validation checklist

Before enabling analysis for real users:

- run `npm run lint`
- run `npm run build`
- request a manual report from a disposable confirmed account
- verify the PDF attachment and summary
- confirm a second manual request inside the cooldown is rejected
- verify Monthly analysis email defaults off
- toggle monthly analysis on/off and confirm persistence
- confirm the cron route rejects an invalid bearer secret
- confirm repeated user/month monthly delivery is skipped
- verify the AI prompt path does not include resume files, private notes, user email, or auth secrets
