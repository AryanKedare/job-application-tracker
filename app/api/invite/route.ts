import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/admin-supabase'
import { verifyInviteCode } from '@/lib/admin-auth'
import { rejectCrossOrigin } from '@/lib/admin-request'

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const body = await request.json().catch(() => null) as {
    action?: unknown
    code?: unknown
    email?: unknown
    name?: unknown
  } | null

  const action = body?.action
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase().slice(0, 128) : ''
  if (!verifyInviteCode(code)) {
    return NextResponse.json({ error: 'This invite code is invalid or has expired.' }, { status: 400 })
  }

  if (action === 'validate') return NextResponse.json({ valid: true })
  if (action !== 'redeem') return NextResponse.json({ error: 'A valid action is required.' }, { status: 400 })

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
  if (!name) return NextResponse.json({ error: 'Your name is required.' }, { status: 400 })
  if (!validEmail(email)) return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })

  try {
    const supabase = getAdminSupabase()
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '')
    const redirectTo = `${siteUrl}/auth/recovery`

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: name, name, invited_by_code: true },
    })

    if (inviteError) {
      if (!/already|registered|exists/i.test(inviteError.message)) throw inviteError
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (recoveryError) throw recoveryError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Invite code redemption failed:', error)
    return NextResponse.json({ error: 'Could not send the password setup email. Please try again.' }, { status: 500 })
  }
}
