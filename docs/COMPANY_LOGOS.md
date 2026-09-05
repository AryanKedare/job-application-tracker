# Automatic company icons

The applications dashboard can replace the initials avatar with a company favicon resolved from the saved company name.

## Requirements

This feature reuses the existing server-side Groq configuration:

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

No additional logo-provider account or browser-facing API key is required. If `GROQ_API_KEY` is unset, the dashboard simply keeps the initials avatar.

## How it works

1. The browser requests the same-origin `/api/company-icon` endpoint for a saved company name.
2. The endpoint requires an authenticated Supabase user.
3. Groq is asked for the company's official public hostname only, for example `microsoft.com`.
4. The returned hostname is strictly validated. IP addresses, malformed hosts, private/reserved DNS targets, credentials, and non-HTTPS targets are rejected.
5. The server requests only conventional favicon paths on the resolved public hostname: `/favicon.ico`, `/apple-touch-icon.png`, and `/favicon.png`.
6. Outbound requests are DNS-pinned and size-limited, redirects are restricted to the same hostname or its `www` variant, and only recognized raster/icon formats are returned.
7. Successful icons are cached by the browser for one week. Groq domain resolutions are cached in server memory for 24 hours when successful and one hour when no reliable domain is found.
8. If any step fails, the existing initials avatar remains visible.

Existing applications work automatically; no database migration or record backfill is required.

## Privacy

The company name is sent to Groq only when an icon needs an uncached domain resolution. Resume files, application notes, status, user email, and other application data are not included in the prompt.

The company website never receives the user's browser request directly. The favicon is fetched server-side through the restricted icon endpoint and returned as a same-origin image response.

## Accuracy

The icon lookup is cosmetic and intentionally conservative. Groq is instructed to return an empty domain when it is uncertain. Ambiguous or obscure company names may therefore continue to display initials rather than risk showing an unrelated company's icon.
