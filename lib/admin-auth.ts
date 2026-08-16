import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE_NAME = 'job-tracker-admin-session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60
export const INVITE_CODE_MAX_AGE_SECONDS = 15 * 60

type AdminSessionPayload = { email: string; expiresAt: number }

const normalizeEmail = (value: string) => value.trim().toLowerCase()
const digest = (value: string) => createHash('sha256').update(value).digest()
const safeEqual = (left: string, right: string) => timingSafeEqual(digest(left), digest(right))
const adminEmail = () => normalizeEmail(process.env.ADMIN_EMAIL ?? '')
const sessionSecret = () => process.env.ADMIN_SESSION_SECRET?.trim() ?? ''

export function adminConfigurationError(): string | null {
  if (!adminEmail()) return 'ADMIN_EMAIL is not configured.'
  if (!(process.env.ADMIN_PASSWORD ?? '')) return 'ADMIN_PASSWORD is not configured.'
  if (sessionSecret().length < 32) return 'ADMIN_SESSION_SECRET must contain at least 32 characters.'
  return null
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  if (adminConfigurationError()) return false
  return safeEqual(normalizeEmail(email), adminEmail()) && safeEqual(password, process.env.ADMIN_PASSWORD ?? '')
}

const sign = (payload: string) => createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
const signInvite = (payload: string) => createHmac('sha256', sessionSecret()).update(`invite:${payload}`).digest('hex').slice(0, 16).toUpperCase()

export function createAdminSessionToken(email: string): string {
  const payload: AdminSessionPayload = {
    email: normalizeEmail(email),
    expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token || adminConfigurationError()) return false
  const [encoded, suppliedSignature, extra] = token.split('.')
  if (!encoded || !suppliedSignature || extra || !safeEqual(suppliedSignature, sign(encoded))) return false

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<AdminSessionPayload>
    return typeof payload.email === 'string' && normalizeEmail(payload.email) === adminEmail() &&
      typeof payload.expiresAt === 'number' && payload.expiresAt > Date.now()
  } catch {
    return false
  }
}

export function createInviteCode(): { code: string; expiresAt: number } {
  if (sessionSecret().length < 32) throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters.')
  const expiresAt = Date.now() + INVITE_CODE_MAX_AGE_SECONDS * 1000
  const expiryToken = Math.floor(expiresAt / 1000).toString(36).toUpperCase()
  const nonce = randomBytes(6).toString('hex').toUpperCase()
  const payload = `${expiryToken}.${nonce}`
  return {
    code: `JT-${expiryToken}-${nonce}-${signInvite(payload)}`,
    expiresAt,
  }
}

export function hashInviteCode(value: string): string {
  return createHash('sha256').update(value.trim().toUpperCase()).digest('hex')
}

export function verifyInviteCode(value: string): boolean {
  if (sessionSecret().length < 32) return false
  const normalized = value.trim().toUpperCase()
  const [prefix, expiryToken, nonce, suppliedSignature, extra] = normalized.split('-')
  if (prefix !== 'JT' || !expiryToken || !nonce || !suppliedSignature || extra) return false
  if (!/^[0-9A-Z]+$/.test(expiryToken) || !/^[0-9A-F]{12}$/.test(nonce) || !/^[0-9A-F]{16}$/.test(suppliedSignature)) return false

  const expiresAt = Number.parseInt(expiryToken, 36) * 1000
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false
  return safeEqual(suppliedSignature, signInvite(`${expiryToken}.${nonce}`))
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
}
