import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-auth'

export function requireAdmin(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
    ? null
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')
  if (!origin) return null
  try {
    return new URL(origin).host === request.nextUrl.host
      ? null
      : NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
}
