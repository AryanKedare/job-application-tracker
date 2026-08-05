import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, adminCookieOptions } from '@/lib/admin-auth'
import { rejectCrossOrigin } from '@/lib/admin-request'

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_COOKIE_NAME, '', { ...adminCookieOptions, maxAge: 0 })
  return response
}
