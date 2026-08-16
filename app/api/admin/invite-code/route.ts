import { NextRequest, NextResponse } from 'next/server'
import { createInviteCode, hashInviteCode } from '@/lib/admin-auth'
import { rejectCrossOrigin, requireAdmin } from '@/lib/admin-request'
import { getAdminSupabase } from '@/lib/admin-supabase'

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  try {
    const invite = createInviteCode()
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('invite_codes').insert({
      code_hash: hashInviteCode(invite.code),
      expires_at: new Date(invite.expiresAt).toISOString(),
    })

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ error: 'Invite-code storage is not configured. Re-run supabase/setup.sql.' }, { status: 500 })
      }
      throw error
    }

    return NextResponse.json({ ...invite, singleUse: true })
  } catch (error) {
    console.error('Invite code generation failed:', error)
    return NextResponse.json({ error: 'Could not generate an invite code.' }, { status: 500 })
  }
}
