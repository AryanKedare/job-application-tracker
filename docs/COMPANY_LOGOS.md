# Automatic company icons

The applications dashboard replaces the initials avatar with a company icon or logo when it can resolve one safely from the saved company name.

## Requirements

This feature reuses the existing server-side Groq configuration:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

No additional logo-provider account or browser-facing API key is required. If `GROQ_API_KEY` is unset, the dashboard simply keeps the initials avatar.

## How it works

The lookup intentionally uses a fast path first and web-search AI only when necessary:

1. The browser requests the same-origin `/api/company-icon` endpoint for a saved company name.
2. The endpoint requires an authenticated Supabase user.
3. The normal Groq model first resolves the likely official company domain.
4. The server tries the site's favicon, declared icon links, JSON-LD organization logo, and logo-like image elements on the official homepage.
5. If no usable raster logo is found, the server calls Groq Compound with its built-in `web_search` and `visit_website` tools.
6. Compound searches for the company's official website and, when available, an official press/media/brand raster logo URL.
7. A direct AI-proposed logo is accepted only when it is HTTPS and hosted on the verified official company hostname or one of its subdomains. Otherwise the server uses the official page returned by the search and discovers logo assets from that page itself.
8. Every outbound image/page fetch still uses DNS validation and IP pinning. Private/reserved addresses are blocked, redirects are constrained, response sizes are limited, and image bytes must match a supported raster/icon signature.
9. If all logo paths fail, the existing initials avatar remains visible.

The web-search fallback runs only after the normal icon lookup fails, so companies that already resolve successfully do not incur a Compound web-search request.

Existing applications work automatically; no database migration or record backfill is required.

## Caching

- successful browser icon blobs are reused during the current page session
- normal company-domain resolutions are cached in server memory for 24 hours
- successful web-search logo resolutions are cached in server memory for 7 days
- unsuccessful web searches are cached for 30 minutes so a temporary failure does not trigger repeated searches on every render

Server-memory caches are best-effort on serverless platforms and may be lost when an instance is recycled.

## Privacy

Only the saved company name and the previously inferred public company domain are included in the logo-resolution prompts.

Resume files, application notes, job status, user email, and other application data are not included.

Groq Compound's web-search and website-visit tools access public web content on Groq's infrastructure. The company website does not receive the user's browser request directly; logo assets are fetched server-side through the restricted same-origin icon endpoint.

## Accuracy and safety

Logo lookup is cosmetic. The system prefers official company websites, press/media pages, and official brand assets and rejects third-party logo repositories as AI-proposed direct sources.

The AI is not trusted as a network security boundary. Every URL it returns is treated as untrusted input and passes through the same URL, DNS, private-address, redirect, size, and image-signature validation used by the rest of the icon fetcher.

Some companies publish only SVG logos or place brand assets behind scripts/CDNs that cannot be validated safely. Those companies may still fall back to initials rather than weakening the outbound-request protections.
