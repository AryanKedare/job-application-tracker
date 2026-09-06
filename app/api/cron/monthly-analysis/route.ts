import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

import {
  AnalysisReportSkip,
  monthlyPeriodKey,
  sendApplicationAnalysisReport,
} from '@/lib/analysis-report-service'
import { getAdminSupabase } from '@/lib/admin-supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

const USERS_PER_PAGE = 1000
const CONCURRENCY = 3

function isAuthorizedCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function isLastUtcDayOfMonth(date: Date) {
  const tomorrow = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  ))
  return tomorrow.getUTCMonth() !== date.getUTCMonth()
}

async function listAllUsers() {
  const supabase = getAdminSupabase()
  const users: User[] = []

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    })
    if (error) throw error

    users.push(...data.users)
    if (data.users.length < USERS_PER_PAGE) break
  }

  return users
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
) {
  let nextIndex = 0
  const count = Math.min(concurrency, items.length)

  await Promise.all(Array.from({ length: count }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await worker(items[index])
    }
  }))
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const now = new Date()
  if (!isLastUtcDayOfMonth(now)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'Not the last UTC day of the month.',
    })
  }

  try {
    const period = monthlyPeriodKey(now)
    const users = await listAllUsers()
    const eligible = users.filter((user) =>
      Boolean(user.email_confirmed_at) &&
      user.user_metadata?.monthly_analysis_enabled === true &&
      user.app_metadata?.monthly_analysis_last_period !== period,
    )

    let sent = 0
    let skipped = 0
    let failed = 0
    const failures: Array<{ userId: string; error: string }> = []

    await runWithConcurrency(eligible, async (user) => {
      try {
        await sendApplicationAnalysisReport(user, {
          mode: 'monthly',
          periodKey: period,
          idempotencyKey: `monthly-application-analysis-${user.id}-${period}`,
        })
        sent += 1
      } catch (error) {
        if (error instanceof AnalysisReportSkip) {
          skipped += 1
          return
        }

        failed += 1
        failures.push({
          userId: user.id,
          error: error instanceof Error ? error.message.slice(0, 160) : 'Unknown error',
        })
        console.error('Monthly analysis report failed for user:', user.id, error)
      }
    }, CONCURRENCY)

    return NextResponse.json({
      ok: failed === 0,
      period,
      users: users.length,
      eligible: eligible.length,
      sent,
      skipped,
      failed,
      failures: failures.slice(0, 20),
    }, { status: failed === 0 ? 200 : 207 })
  } catch (error) {
    console.error('Monthly analysis cron failed:', error)
    return NextResponse.json({ error: 'Monthly analysis job failed.' }, { status: 500 })
  }
}
