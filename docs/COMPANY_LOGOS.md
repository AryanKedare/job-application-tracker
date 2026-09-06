# Automatic Company Logos

The applications dashboard replaces the initials avatar with a company icon/logo when it can resolve one safely from the saved company name.

The feature is intentionally cost-aware: it prefers cached results and normal official-site discovery before using AI web search.

## Configuration

Server-side Groq configuration:

```env
GROQ_API_KEY=
GROQ_LOGO_MODEL=llama-3.1-8b-instant
GROQ_LOGO_WEB_MODEL=groq/compound-mini
```

`GROQ_MODEL` / `openai/gpt-oss-20b` remain available as a fallback if the small logo-domain model is unavailable.

No Brandfetch/Clearbit/logo-provider account or browser-facing API key is required.

If `GROQ_API_KEY` is unset, the dashboard falls back to initials whenever it cannot resolve a logo without AI.

## Persistent cache requirement

The canonical database setup creates:

```text
public.company_logo_cache
```

Fresh installs get this table automatically by running:

```text
supabase/setup.sql
```

Existing installations should re-run the current `supabase/setup.sql` once to add/configure the cache.

No separate logo-cache migration is required for the current release.

The cache is server-only. Browser roles have no direct access.

It stores only public company-resolution metadata:

- normalized company key
- official domain
- official website URL when found
- official logo URL when found
- resolver model
- resolution/expiry timestamps

It does not contain user IDs, application IDs, resumes, notes, emails, or authentication data.

## Resolution flow

For a saved company name:

1. The browser requests the same-origin `/api/company-icon` route as an authenticated user.
2. The server checks persistent/in-memory cached resolution data.
3. If needed, `GROQ_LOGO_MODEL` resolves the likely official public company domain.
4. The server tries safe official-site sources such as favicon paths, declared icon links, JSON-LD organization logos, and logo-like homepage images.
5. If normal discovery still fails, `GROQ_LOGO_WEB_MODEL` uses Groq Compound Mini web search/website visiting to locate the official site or official brand/media asset.
6. AI-proposed URLs are treated as untrusted input.
7. A direct logo is accepted only if it is HTTPS and belongs to the verified official hostname/subdomain boundary.
8. Outbound requests still go through DNS validation, IP pinning, private/reserved-network blocking, redirect restrictions, response-size limits, and raster image signature checks.
9. If no safe logo is found, the initials avatar remains visible.

The browser never needs to contact the company website directly.

## Cost controls

The logo path intentionally uses the cheapest reasonable option first:

```text
persistent cache
    ↓ miss
small logo/domain model
    ↓
official-site favicon/logo discovery
    ↓ only if needed
Compound Mini web search
```

Current cache policy:

- positive AI company-resolution results: reused for about 30 days
- negative AI resolution results: reused for about 12 hours
- browser blob results: reused for the current page/module session
- in-memory request de-duplication prevents duplicate simultaneous requests for the same company within one server/browser instance

The persistent Supabase cache is the important layer for Vercel/serverless deployments because in-memory caches can disappear on cold start.

## Privacy

Logo AI receives only public company-resolution context such as:

- saved company name
- previously inferred public domain when applicable

It does not receive:

- user email
- resume files
- resume paths
- application notes
- job status
- authentication tokens
- unrelated application data

Groq's web-search/website-visit tools access public web content on Groq infrastructure. The application then validates any returned network target before using it.

## Accuracy and safety

Logo lookup is cosmetic. The application prefers official company websites/brand assets and deliberately rejects third-party logo repositories as trusted direct AI sources.

Some companies may still show initials because:

- only SVG assets are available
- the logo is loaded entirely through client-side JavaScript
- the logo is hosted on a third-party CDN that cannot be safely tied to the official domain
- the official site blocks automated access
- the company name is ambiguous

The application should prefer a safe initials fallback over weakening outbound-network protections.

## Troubleshooting

### Logos work, but AI credits keep increasing

Confirm:

- `public.company_logo_cache` exists
- `SUPABASE_SERVICE_ROLE_KEY` is configured server-side
- the current `supabase/setup.sql` has been applied
- `GROQ_LOGO_MODEL` is set to the intended low-cost model

### Most logos fall back to initials

Check server logs for `/api/company-icon` and confirm the Groq key/model are available. Some companies legitimately cannot be resolved under the current safe raster/domain rules.

### A logo is wrong

The cache can retain a prior resolution until expiry. Correct the company name in the application first. If the official company identity genuinely changed, the server-side cache row can be cleared by an operator with appropriate Supabase access so it will be resolved again.
