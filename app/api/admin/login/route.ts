import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_COOKIE_NAME,
  adminConfigurationError,
  adminCookieOptions,
  createAdminSessionToken,
  verifyAdminCredentials,
} from '@/lib/admin-auth'
import { rejectCrossOrigin } from '@/lib/admin-request'
import { consumeBudget, securityErrorResponse, trustedClientKey } from '@/lib/security-controls'

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const configurationError = adminConfigurationError()
  if (configurationError) return NextResponse.json({ error: configurationError }, { status: 503 })

  try {
    await consumeBudget([
      { key: 'admin:account:minute', limit: 5, seconds: 60 },
      { key: 'admin:account:hour', limit: 20, seconds: 3600 },
      { key: `admin:ip:${trustedClientKey(request)}`, limit: 5, seconds: 900 },
    ])
  } catch (error) {
    return securityErrorResponse(error) ?? NextResponse.json({ error: 'Login protection is unavailable.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.slice(0, 254) : ''
  const password = typeof body?.password === 'string' ? body.password.slice(0, 512) : ''

  if (!verifyAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionToken(email), adminCookieOptions)
  return response
}
