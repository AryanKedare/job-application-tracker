import { NextRequest, NextResponse } from 'next/server'

import { getAdminSupabase } from '@/lib/admin-supabase'
import { verifyEmailUnsubscribeToken } from '@/lib/email-unsubscribe'

export const runtime = 'nodejs'

function redirectWithStatus(request: NextRequest, status: 'success' | 'invalid' | 'error') {
  const url = new URL('/email/unsubscribe', request.url)
  url.searchParams.set('status', status)
  return NextResponse.redirect(url, 303)
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const tokenValue = form?.get('token')
  const token = typeof tokenValue === 'string' ? tokenValue.trim().slice(0, 512) : ''
  const userId = token ? verifyEmailUnsubscribeToken(token) : null

  if (!userId) return redirectWithStatus(request, 'invalid')

  try {
    const supabase = getAdminSupabase()
    const { data, error: getError } = await supabase.auth.admin.getUserById(userId)
    if (getError || !data.user) return redirectWithStatus(request, 'invalid')

    const metadata = {
      ...(data.user.user_metadata ?? {}),
      email_updates_enabled: false,
      email_updates_changed_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { user_metadata: metadata })
    if (updateError) throw updateError

    return redirectWithStatus(request, 'success')
  } catch (error) {
    console.error('Email unsubscribe failed:', error)
    return redirectWithStatus(request, 'error')
  }
}
