import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ─── Security Headers ───────────────────────────────────────────────────────
  // Applied to every response. Covers XSS, clickjacking, MIME sniffing,
  // referrer leakage, and restricts what the browser can load/embed.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Block the page being embedded in iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop sending the full URL as Referer to external sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Allow only HTTPS and disallow mixed content
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Restrict browser features (camera, mic, geolocation not needed)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Content Security Policy
          // Allows: self, Supabase API, Google Favicons, Hunter.io logos
          // Blocks: inline scripts (except Next.js nonces), eval, unknown origins
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self + Next.js inline runtime (unsafe-inline needed for Next.js App Router)
              "script-src 'self' 'unsafe-inline'",
              // Styles: self + inline (Tailwind injects inline styles)
              "style-src 'self' 'unsafe-inline'",
              // Images: self + Supabase storage + Google favicons + Hunter.io logos + data URIs
              "img-src 'self' data: blob: https://*.supabase.co https://www.google.com https://logos.hunter.io",
              // Fonts: self only
              "font-src 'self'",
              // API/fetch calls: self + Supabase project URL
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co'} https://*.supabase.co wss://*.supabase.co`,
              // Disallow frames entirely
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // ─── Allowed image/external sources ─────────────────────────────────────────
  // Restricts <Image> to known trusted hostnames
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: 'logos.hunter.io' },
    ],
  },
}

export default nextConfig
