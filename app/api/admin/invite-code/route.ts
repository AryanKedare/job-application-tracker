import { NextRequest, NextResponse } from 'next/server'
import { createInviteCode } from '@/lib/admin-auth'
import { rejectCrossOrigin, requireAdmin } from '@/lib/admin-request'

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  try {
    const invite = createInviteCode()
    return NextResponse.json(invite)
  } catch (error) {
    console.error('Invite code generation failed:', error)
    return NextResponse.json({ error: 'Could not generate an invite code.' }, { status: 500 })
  }
}
