import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/admin-supabase'
import { rejectCrossOrigin } from '@/lib/admin-request'
import { consumeBudget, securityErrorResponse, trustedClientKey } from '@/lib/security-controls'

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function accountExists(email: string) {
  const supabase = getAdminSupabase()

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    if (data.users.some((user) => user.email?.toLowerCase() === email)) return true
    if (data.users.length < 1000) return false
  }

  return false
}

export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_ACCESS_REQUEST_EMAIL?.trim()) {
    return NextResponse.json({ error: 'Access requests are not enabled.' }, { status: 404 })
  }

  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const body = await request.json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  if (!validEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  try {
    await consumeBudget([
      { key: 'access:global', limit: 30, seconds: 60 },
      { key: `access:ip:${trustedClientKey(request)}`, limit: 5, seconds: 60 },
    ])
    const exists = await accountExists(email)
    return NextResponse.json({ exists }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const protectionError = securityErrorResponse(error)
    if (protectionError) return protectionError
    console.error('Access request account check failed:', error)
    return NextResponse.json({ error: 'Could not check this email address right now.' }, { status: 500 })
  }
}
