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
  if (!maintenanceEnabled()) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Keep the maintenance page and admin portal reachable for everyone who needs them.
  if (pathname === '/maintenance' || isAdminPath(pathname)) {
    return NextResponse.next()
  }

  // A valid signed admin session can use the real production app while maintenance
  // remains enabled for normal visitors. This also allows the admin to sign in to a
  // normal user account and exercise user-specific production flows in the same browser.
  if (hasAdminMaintenanceBypass(request)) {
    const response = NextResponse.next()
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

  const response = NextResponse.rewrite(new URL('/maintenance', request.url))
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Retry-After', '3600')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml).*)'],
}
