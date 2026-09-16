import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-auth'

function maintenanceEnabled() {
  return process.env.MAINTENANCE_MODE?.trim().toLowerCase() === 'true'
}

function isAdminPath(pathname: string) {
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/api/admin'
    || pathname.startsWith('/api/admin/')
}

function hasAdminMaintenanceBypass(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
}

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const origin = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const websocket = origin.replace(/^http/, 'ws')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${origin}`,
    "font-src 'self'",
    `connect-src 'self' ${origin} ${websocket}`,
    "frame-src 'none'", "frame-ancestors 'none'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'",
    ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = maintenanceResponse(request, requestHeaders)
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Content-Security-Policy', csp)
    // HTML containing a per-request nonce must never enter a shared cache.
    response.headers.set('Cache-Control', 'private, no-store')
  }
  return response
}

function maintenanceResponse(request: NextRequest, headers: Headers) {
  if (!maintenanceEnabled()) return NextResponse.next({ request: { headers } })

  const { pathname } = request.nextUrl

  // Keep the maintenance page and admin portal reachable for everyone who needs them.
  if (pathname === '/maintenance' || isAdminPath(pathname)) {
    return NextResponse.next({ request: { headers } })
  }

  // A valid signed admin session can use the real production app while maintenance
  // remains enabled for normal visitors. This also allows the admin to sign in to a
  // normal user account and exercise user-specific production flows in the same browser.
  if (hasAdminMaintenanceBypass(request)) {
    const response = NextResponse.next({ request: { headers } })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Job Tracker is temporarily unavailable for maintenance.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '3600',
        },
      },
    )
  }

  const response = NextResponse.rewrite(new URL('/maintenance', request.url), { request: { headers } })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Retry-After', '3600')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
}
