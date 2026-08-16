import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/admin-supabase'
import { hashInviteCode, verifyInviteCode } from '@/lib/admin-auth'
import { rejectCrossOrigin } from '@/lib/admin-request'

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function invalidInviteResponse() {
  return NextResponse.json({ error: 'This invite code is invalid, expired, or has already been used.' }, { status: 400 })
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
  if (!verifyInviteCode(code)) return invalidInviteResponse()

  const codeHash = hashInviteCode(code)

  try {
    const supabase = getAdminSupabase()
    const now = new Date().toISOString()

    if (action === 'validate') {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('id')
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .gt('expires_at', now)
        .maybeSingle()

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return NextResponse.json({ error: 'Invite-code storage is not configured. Ask the administrator to run the latest setup.' }, { status: 503 })
        }
        throw error
      }

      return data ? NextResponse.json({ valid: true }) : invalidInviteResponse()
    }

    if (action !== 'redeem') return NextResponse.json({ error: 'A valid action is required.' }, { status: 400 })

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
    if (!name) return NextResponse.json({ error: 'Your name is required.' }, { status: 400 })
    if (!validEmail(email)) return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })

    const claimedAt = new Date().toISOString()
    const { data: claimedInvite, error: claimError } = await supabase
      .from('invite_codes')
      .update({ used_at: claimedAt })
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .gt('expires_at', claimedAt)
      .select('id')
      .maybeSingle()

    if (claimError) {
      if (claimError.code === '42P01' || claimError.code === 'PGRST205') {
        return NextResponse.json({ error: 'Invite-code storage is not configured. Ask the administrator to run the latest setup.' }, { status: 503 })
      }
      throw claimError
    }
    if (!claimedInvite) return invalidInviteResponse()

    try {
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
      await supabase
        .from('invite_codes')
        .update({ used_at: null })
        .eq('id', claimedInvite.id)
        .eq('used_at', claimedAt)

      throw error
    }
  } catch (error) {
    console.error('Invite code redemption failed:', error)
    return NextResponse.json({ error: 'Could not send the password setup email. Please try again.' }, { status: 500 })
  }
}
