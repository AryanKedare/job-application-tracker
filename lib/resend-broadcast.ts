const RESEND_API_BASE = 'https://api.resend.com'
const BATCH_SIZE = 100

export interface DirectEmail {
  to: string
  subject: string
  html: string
  text: string
}

interface ResendResult {
  ok: boolean
  status: number
  data: Record<string, unknown>
}

function apiKey() {
  const value = process.env.RESEND_API_KEY?.trim()
  if (!value) throw new Error('Resend is not configured.')
  return value
}

export function getResendConfig() {
  const from = process.env.RESEND_FROM?.trim()
  if (!from) throw new Error('Resend sender is not configured.')
  return { from }
}

async function resendRequest(
  path: string,
  init: RequestInit,
  idempotencyKey?: string,
): Promise<ResendResult> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey()}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  const raw = await response.text()
  let data: Record<string, unknown> = {}
  if (raw) {
    try {
      data = JSON.parse(raw) as Record<string, unknown>
    } catch {
      data = { message: raw.slice(0, 500) }
    }
  }

  return { ok: response.ok, status: response.status, data }
}

function resendError(result: ResendResult, fallback: string) {
  const message = typeof result.data.message === 'string'
    ? result.data.message
    : typeof result.data.error === 'string'
      ? result.data.error
      : fallback
  return new Error(message)
}

export async function sendDirectEmails(options: {
  from: string
  emails: DirectEmail[]
  idempotencyKey: string
}) {
  let sentCount = 0

  for (let index = 0; index < options.emails.length; index += BATCH_SIZE) {
    const batch = options.emails.slice(index, index + BATCH_SIZE)
    const result = await resendRequest('/emails/batch', {
      method: 'POST',
      body: JSON.stringify(batch.map((email) => ({
        from: options.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: 'category', value: 'admin_update' }],
      }))),
    }, `${options.idempotencyKey}-${Math.floor(index / BATCH_SIZE) + 1}`)

    if (!result.ok) throw resendError(result, 'Could not send the selected Resend emails.')
    sentCount += batch.length
  }

  return sentCount
}

export async function sendTestEmail(options: {
  from: string
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}) {
  const result = await resendRequest('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: `[TEST] ${options.subject}`,
      html: options.html,
      text: options.text,
      tags: [{ name: 'category', value: 'admin_update_test' }],
    }),
  }, options.idempotencyKey)

  if (!result.ok) throw resendError(result, 'Could not send the Resend test email.')
  return typeof result.data.id === 'string' ? result.data.id : null
}

export async function sendPdfEmail(options: {
  from: string
  to: string
  subject: string
  html: string
  text: string
  filename: string
  pdf: Buffer
  idempotencyKey: string
}) {
  const result = await resendRequest('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: [{
        filename: options.filename,
        content: options.pdf.toString('base64'),
        content_type: 'application/pdf',
      }],
      tags: [{ name: 'category', value: 'application_analysis' }],
    }),
  }, options.idempotencyKey)

  if (!result.ok) throw resendError(result, 'Could not email the analysis PDF.')
  return typeof result.data.id === 'string' ? result.data.id : null
}
