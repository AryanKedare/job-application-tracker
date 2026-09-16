import { createClient } from '@supabase/supabase-js'
import { securityErrorResponse } from '@/lib/security-controls'
import { NextRequest, NextResponse } from 'next/server'

import {
  AnalysisReportSkip,
  sendApplicationAnalysisReport,
} from '@/lib/analysis-report-service'

export const runtime = 'nodejs'
export const maxDuration = 45

async function authenticatedUser(request: NextRequest) {
  const authorization = request.headers.get('authorization')?.trim() ?? ''
  const accessToken = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : ''
  if (!accessToken) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  return error ? null : user
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!user.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: 'A confirmed account email is required.' }, { status: 400 })
  }

  try {
    const result = await sendApplicationAnalysisReport(user, {
      mode: 'manual',
    })

    return NextResponse.json({
      ok: true,
      email: result.email,
      model: result.model,
      applications: result.applications,
    })
  } catch (error) {
    const protectionError = securityErrorResponse(error)
    if (protectionError) return protectionError
    if (error instanceof AnalysisReportSkip) {
      if (error.code === 'no_applications') {
        return NextResponse.json({ error: 'Add at least one application before generating a report.' }, { status: 400 })
      }
      if (error.code === 'unconfirmed_email') {
        return NextResponse.json({ error: 'A confirmed account email is required.' }, { status: 400 })
      }
    }

    console.error('Application analysis report failed:', error)
    const unavailable = error instanceof Error && error.message.includes('AI analysis is temporarily unavailable')
    return NextResponse.json(
      { error: unavailable ? 'AI analysis is temporarily unavailable. Please try again.' : 'Could not generate and email the report. Please try again.' },
      { status: unavailable ? 503 : 500 },
    )
  }
}
