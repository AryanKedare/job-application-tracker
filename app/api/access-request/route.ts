import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/admin-supabase'
import { rejectCrossOrigin } from '@/lib/admin-request'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, { count: number; resetAt: number }>()

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function clientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

function rateLimited(request: NextRequest) {
  const now = Date.now()
  const key = clientKey(request)
  const current = attempts.get(key)

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (current.count >= MAX_ATTEMPTS) return true
  current.count += 1
  attempts.set(key, current)
  return false
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

  if (rateLimited(request)) {
    return NextResponse.json({ error: 'Too many access checks. Please wait a minute and try again.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  if (!validEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  try {
    const exists = await accountExists(email)
    return NextResponse.json({ exists }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Access request account check failed:', error)
    return NextResponse.json({ error: 'Could not check this email address right now.' }, { status: 500 })
  }
}
