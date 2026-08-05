import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/admin-supabase'
import { rejectCrossOrigin, requireAdmin } from '@/lib/admin-request'

interface AdminUserRow {
  id: string
  email: string
  name: string
  createdAt: string
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  jobCount: number
}

async function listAllUsers() {
  const supabase = getAdminSupabase()
  const users = []
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) break
  }
  return users
}

async function jobCountsByUser(): Promise<Map<string, number>> {
  const supabase = getAdminSupabase()
  const counts = new Map<string, number>()
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await supabase
      .from('job_applications')
      .select('user_id')
      .range(from, from + 999)
    if (error) throw error
    for (const row of data ?? []) {
      if (typeof row.user_id === 'string') counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
    }
    if (!data || data.length < 1000) break
  }
  return counts
}

async function deleteResumeFolder(userId: string) {
  const supabase = getAdminSupabase()
  for (let offset = 0; offset < 10_000; offset += 100) {
    const { data, error } = await supabase.storage.from('resumes').list(userId, { limit: 100, offset })
    if (error) throw error
    if (!data?.length) break
    const paths = data.filter((item) => item.name).map((item) => `${userId}/${item.name}`)
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from('resumes').remove(paths)
      if (removeError) throw removeError
    }
    if (data.length < 100) break
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized

  try {
    const [users, counts] = await Promise.all([listAllUsers(), jobCountsByUser()])
    const rows: AdminUserRow[] = users.map((user) => ({
      id: user.id,
      email: user.email ?? '',
      name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''),
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      jobCount: counts.get(user.id) ?? 0,
    }))
    const totalJobs = [...counts.values()].reduce((sum, value) => sum + value, 0)
    return NextResponse.json({
      users: rows,
      stats: {
        totalUsers: rows.length,
        totalJobs,
        activeUsers: rows.filter((user) => user.jobCount > 0).length,
        averageJobs: rows.length ? Number((totalJobs / rows.length).toFixed(1)) : 0,
      },
    })
  } catch (error) {
    console.error('Admin users load failed:', error)
    return NextResponse.json({ error: 'Could not load admin data.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const body = await request.json().catch(() => null) as { userId?: unknown; name?: unknown; email?: unknown } | null
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  if (!userId || !email || !email.includes('@')) return NextResponse.json({ error: 'Valid user details are required.' }, { status: 400 })

  try {
    const supabase = getAdminSupabase()
    const { data: existing, error: getError } = await supabase.auth.admin.getUserById(userId)
    if (getError || !existing.user) throw getError ?? new Error('User not found')
    const metadata = { ...(existing.user.user_metadata ?? {}), full_name: name, name }
    const { error } = await supabase.auth.admin.updateUserById(userId, { email, user_metadata: metadata })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin user update failed:', error)
    return NextResponse.json({ error: 'Could not update this user.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const body = await request.json().catch(() => null) as { action?: unknown; email?: unknown } | null
  const action = body?.action
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  if ((action !== 'recovery' && action !== 'magic-link') || !email) {
    return NextResponse.json({ error: 'A valid action and email are required.' }, { status: 400 })
  }

  try {
    const supabase = getAdminSupabase()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
    const result = action === 'recovery'
      ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/callback?next=/reset-password` })
      : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${siteUrl}/auth/callback`, shouldCreateUser: false } })
    if (result.error) throw result.error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin email action failed:', error)
    return NextResponse.json({ error: 'Could not send the email.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const body = await request.json().catch(() => null) as { userId?: unknown } | null
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!userId) return NextResponse.json({ error: 'A user ID is required.' }, { status: 400 })

  try {
    const supabase = getAdminSupabase()
    const { error: jobsError } = await supabase.from('job_applications').delete().eq('user_id', userId)
    if (jobsError) throw jobsError
    await deleteResumeFolder(userId)
    const { error: userError } = await supabase.auth.admin.deleteUser(userId)
    if (userError) throw userError
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin user deletion failed:', error)
    return NextResponse.json({ error: 'Could not delete this account.' }, { status: 500 })
  }
}
