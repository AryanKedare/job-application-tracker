import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function maintenanceEnabled() {
  return process.env.MAINTENANCE_MODE?.trim().toLowerCase() === 'true'
}

function isAdminPath(pathname: string) {
  return pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/api/admin'
    || pathname.startsWith('/api/admin/')
}

export function proxy(request: NextRequest) {
  if (!maintenanceEnabled()) return NextResponse.next()

  const { pathname } = request.nextUrl

  if (pathname === '/maintenance' || isAdminPath(pathname)) {
    return NextResponse.next()
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
