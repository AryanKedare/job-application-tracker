import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_VERSION = 'v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function unsubscribeSecret() {
  const value = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim()
  if (!value || value.length < 32) {
    throw new Error('EMAIL_UNSUBSCRIBE_SECRET is not configured with at least 32 characters.')
  }
  return value
}

function signatureFor(payload: string) {
  return createHmac('sha256', unsubscribeSecret())
    .update(`job-tracker-email-unsubscribe:${TOKEN_VERSION}:${payload}`)
    .digest('base64url')
}

export function createEmailUnsubscribeToken(userId: string) {
  if (!UUID_PATTERN.test(userId)) throw new Error('Cannot create an unsubscribe token for an invalid user ID.')
  const payload = Buffer.from(userId, 'utf8').toString('base64url')
  return `${TOKEN_VERSION}.${payload}.${signatureFor(payload)}`
}

export function verifyEmailUnsubscribeToken(token: string) {
  const [version, payload, providedSignature, ...extra] = token.split('.')
  if (version !== TOKEN_VERSION || !payload || !providedSignature || extra.length) return null

  try {
    const expectedSignature = signatureFor(payload)
    const expected = Buffer.from(expectedSignature, 'utf8')
    const provided = Buffer.from(providedSignature, 'utf8')
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null

    const userId = Buffer.from(payload, 'base64url').toString('utf8')
    return UUID_PATTERN.test(userId) ? userId : null
  } catch {
    return null
  }
}
