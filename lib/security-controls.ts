import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/admin-supabase'

export class SecurityControlError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter = 0) {
    super(message)
  }
}

export function securityErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof SecurityControlError)) return null
  return NextResponse.json({ error: error.message }, {
    status: error.status,
    headers: { 'Cache-Control': 'no-store', ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) },
  })
}

export async function requireMembership(userId: string) {
  const { data, error } = await getAdminSupabase().from('app_memberships')
    .select('status').eq('user_id', userId).maybeSingle()
  if (error) throw new SecurityControlError('Access checks are temporarily unavailable.', 503)
  if (data?.status !== 'active') throw new SecurityControlError('An active invitation is required.', 403)
}

export function trustedClientKey(request: Request): string {
  // Opt in only to a header that the deployment proxy OVERWRITES. Never infer
  // trust from a client-supplied x-forwarded-for or x-real-ip header.
  const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase()
  const ip = header ? request.headers.get(header)?.trim() : null
  if (!ip || !isIP(ip)) return 'unknown'
  const canonical = isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip
  return createHash('sha256').update(canonical).digest('hex')
}

export async function consumeBudget(rules: Array<{ key: string; limit: number; seconds: number }>) {
  const { data, error } = await getAdminSupabase().rpc('consume_security_budget', { p_rules: rules })
  if (error || typeof data !== 'number') {
    throw new SecurityControlError('Request protection is temporarily unavailable.', 503)
  }
  if (data > 0) {
    console.warn('Security request limit reached', { scope: rules[0]?.key.split(':')[0] })
    throw new SecurityControlError('Too many requests. Please try again later.', 429, data)
  }
}

export async function beginAiWork(userId: string, kind: 'import' | 'logo' | 'analysis') {
  const { data, error } = await getAdminSupabase().rpc('reserve_ai_work', { p_user_id: userId, p_kind: kind })
  if (error || !data) throw new SecurityControlError('AI request protection is temporarily unavailable.', 503)
  if (data.denied) throw new SecurityControlError('An active invitation is required.', 403)
  if (!data.lease_id) throw new SecurityControlError('AI usage limit reached. Please try again later.', 429, data.retry_after || 60)
  return data.lease_id as string
}

export async function finishAiWork(leaseId: string) {
  const { error } = await getAdminSupabase().from('security_work_leases').delete().eq('id', leaseId)
  // A failed release stays reserved until expiry; it must never admit extra work.
  if (error) console.error('Could not release AI work reservation', { code: error.code })
}
