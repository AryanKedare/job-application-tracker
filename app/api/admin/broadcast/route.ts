import { NextRequest, NextResponse } from 'next/server'

import { getAdminSupabase } from '@/lib/admin-supabase'
import { rejectCrossOrigin, requireAdmin } from '@/lib/admin-request'
import { createEmailUnsubscribeToken } from '@/lib/email-unsubscribe'
import { getResendConfig, sendDirectEmails, sendTestEmail } from '@/lib/resend-broadcast'

export const runtime = 'nodejs'

const MAX_SUBJECT_LENGTH = 140
const MAX_MESSAGE_LENGTH = 10_000
const MAX_CTA_LABEL_LENGTH = 80
const MAX_ALL_RECIPIENTS = 10_000
const MAX_DIRECT_RECIPIENTS = 1_000

interface EmailContact {
  userId?: string
  email: string
  name: string
  emailUpdatesEnabled: boolean
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function messageHtml(message: string) {
  return message
    .split(/\n\s*\n/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.7;color:#cbd5e1;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function buildContent(options: {
  subject: string
  message: string
  ctaLabel: string
  ctaUrl: string
  siteUrl: string
  recipientName?: string
  testMode?: boolean
  registeredRecipient?: boolean
  unsubscribeUrl?: string
}) {
  const firstName = options.recipientName?.trim().split(/\s+/)[0] ?? ''
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,'

  const footer = options.testMode
    ? {
        html: '<p style="margin:0;">This is a test of the Job Application Tracker update email. Registered-user product emails include an unsubscribe link.</p>',
        text: `Job Application Tracker: ${options.siteUrl}\nThis is a test email. Registered-user product emails include an unsubscribe link.`,
      }
    : options.registeredRecipient && options.unsubscribeUrl
      ? {
          html: `<p style="margin:0 0 8px;">This product update was sent to your Job Application Tracker account. <a href="${escapeHtml(options.siteUrl)}" style="color:#94a3b8;">Open Job Application Tracker</a>.</p><p style="margin:0;"><a href="${escapeHtml(options.unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from product updates</a> or change this anytime in Account settings.</p>`,
          text: `This product update was sent to your Job Application Tracker account.\n${options.siteUrl}\nUnsubscribe from product updates: ${options.unsubscribeUrl}\nYou can also change this anytime in Account settings.`,
        }
      : options.registeredRecipient
        ? {
            html: `<p style="margin:0;">This update was sent to your Job Application Tracker account. <a href="${escapeHtml(options.siteUrl)}" style="color:#94a3b8;">Open Job Application Tracker</a>.</p>`,
            text: `This update was sent to your Job Application Tracker account.\n${options.siteUrl}`,
          }
        : {
            html: `<p style="margin:0;">This one-off update was sent directly by Job Application Tracker. <a href="${escapeHtml(options.siteUrl)}" style="color:#94a3b8;">Open Job Application Tracker</a>.</p>`,
            text: `This one-off update was sent directly by Job Application Tracker.\n${options.siteUrl}`,
          }

  const cta = options.ctaLabel && options.ctaUrl
    ? `<p style="margin:28px 0;"><a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;border-radius:10px;background:#10b981;color:#04110d;padding:12px 18px;font-weight:700;text-decoration:none;">${escapeHtml(options.ctaLabel)}</a></p>`
    : ''

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.subject)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #1e293b;border-radius:18px;background:#0f172a;overflow:hidden;">
          <tr><td style="padding:30px 32px 18px;">
            <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a78bfa;">Job Application Tracker</div>
            <h1 style="margin:12px 0 24px;font-size:26px;line-height:1.25;color:#f8fafc;">${escapeHtml(options.subject)}</h1>
            <p style="margin:0 0 18px;line-height:1.7;color:#cbd5e1;">${greeting}</p>
            ${messageHtml(options.message)}
            ${cta}
          </td></tr>
          <tr><td style="border-top:1px solid #1e293b;padding:20px 32px 28px;font-size:12px;line-height:1.6;color:#64748b;">
            ${footer.html}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  const text = [
    options.subject,
    '',
    greeting.replace(/<[^>]+>/g, ''),
    '',
    options.message,
    options.ctaLabel && options.ctaUrl ? `\n${options.ctaLabel}: ${options.ctaUrl}` : '',
    '',
    footer.text,
  ].filter((value) => value !== '').join('\n')

  return { html, text }
}

async function listConfirmedUsers(selectedIds?: Set<string>): Promise<EmailContact[]> {
  const supabase = getAdminSupabase()
  const contacts: EmailContact[] = []

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error

    for (const user of data.users) {
      if (selectedIds && !selectedIds.has(user.id)) continue
      const email = user.email?.trim().toLowerCase() ?? ''
      if (!email || !user.email_confirmed_at) continue
      const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').trim()
      contacts.push({
        userId: user.id,
        email,
        name,
        emailUpdatesEnabled: user.user_metadata?.email_updates_enabled !== false,
      })

      const limit = selectedIds ? MAX_DIRECT_RECIPIENTS : MAX_ALL_RECIPIENTS
      if (contacts.length > limit) throw new Error('The recipient limit has been exceeded.')
    }

    if (data.users.length < 1000) break
  }

  return contacts
}

function parseSelectedIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()
  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => /^[0-9a-f-]{20,64}$/i.test(item))
  return new Set(ids.slice(0, MAX_DIRECT_RECIPIENTS))
}

function parseCustomEmails(value: unknown): EmailContact[] {
  if (typeof value !== 'string') return []
  const raw = value
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  const unique = [...new Set(raw)]
  if (unique.length > MAX_DIRECT_RECIPIENTS) throw new Error('The direct recipient limit has been exceeded.')
  const invalid = unique.find((email) => email.length > 254 || !validEmail(email))
  if (invalid) throw new Error(`Invalid email address: ${invalid}`)
  return unique.map((email) => ({ email, name: '', emailUpdatesEnabled: true }))
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request)
  if (unauthorized) return unauthorized
  const originError = rejectCrossOrigin(request)
  if (originError) return originError

  const body = await request.json().catch(() => null) as {
    action?: unknown
    recipientMode?: unknown
    selectedUserIds?: unknown
    customEmails?: unknown
    subject?: unknown
    message?: unknown
    ctaLabel?: unknown
    ctaUrl?: unknown
    requestId?: unknown
  } | null

  const action = body?.action === 'test' || body?.action === 'send' || body?.action === 'broadcast' ? body.action : null
  const recipientMode = body?.recipientMode === 'selected' || body?.recipientMode === 'custom' ? body.recipientMode : 'all'
  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT_LENGTH) : ''
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : ''
  const ctaLabel = typeof body?.ctaLabel === 'string' ? body.ctaLabel.trim().slice(0, MAX_CTA_LABEL_LENGTH) : ''
  const ctaUrl = typeof body?.ctaUrl === 'string' ? body.ctaUrl.trim().slice(0, 2048) : ''
  const requestId = typeof body?.requestId === 'string' ? body.requestId.trim().slice(0, 80) : ''

  if (!action || !subject || !message || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
    return NextResponse.json({ error: 'Subject, message, and a valid request are required.' }, { status: 400 })
  }
  if (Boolean(ctaLabel) !== Boolean(ctaUrl)) {
    return NextResponse.json({ error: 'Provide both a button label and HTTPS URL, or leave both empty.' }, { status: 400 })
  }
  if (ctaUrl && !validHttpsUrl(ctaUrl)) {
    return NextResponse.json({ error: 'The button URL must be a valid HTTPS address.' }, { status: 400 })
  }

  try {
    const { from } = getResendConfig()
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '')

    if (action === 'test') {
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''
      if (!adminEmail) return NextResponse.json({ error: 'ADMIN_EMAIL is not configured.' }, { status: 503 })

      const content = buildContent({ subject, message, ctaLabel, ctaUrl, siteUrl, testMode: true })
      const emailId = await sendTestEmail({
        from,
        to: adminEmail,
        subject,
        html: content.html,
        text: content.text,
        idempotencyKey: `admin-test-${requestId}`,
      })
      return NextResponse.json({ ok: true, emailId, recipientCount: 1, sentCount: 1, skippedPreferenceCount: 0 })
    }

    let contacts: EmailContact[]
    let registeredRecipient = true
    let skippedPreferenceCount = 0

    if (recipientMode === 'all') {
      const confirmed = await listConfirmedUsers()
      if (!confirmed.length) return NextResponse.json({ error: 'There are no confirmed users to email.' }, { status: 400 })
      contacts = confirmed.filter((contact) => contact.emailUpdatesEnabled)
      skippedPreferenceCount = confirmed.length - contacts.length
      if (!contacts.length) return NextResponse.json({ error: 'All confirmed users have opted out of product update emails.' }, { status: 400 })
    } else if (recipientMode === 'selected') {
      const selectedIds = parseSelectedIds(body?.selectedUserIds)
      if (!selectedIds.size) return NextResponse.json({ error: 'Select at least one confirmed user.' }, { status: 400 })
      const selected = await listConfirmedUsers(selectedIds)
      if (!selected.length) return NextResponse.json({ error: 'None of the selected users can receive this update.' }, { status: 400 })
      contacts = selected.filter((contact) => contact.emailUpdatesEnabled)
      skippedPreferenceCount = selected.length - contacts.length
      if (!contacts.length) return NextResponse.json({ error: 'All selected users have opted out of product update emails.' }, { status: 400 })
    } else {
      contacts = parseCustomEmails(body?.customEmails)
      registeredRecipient = false
      if (!contacts.length) return NextResponse.json({ error: 'Enter at least one custom email address.' }, { status: 400 })
    }

    const emails = contacts.map((contact) => {
      const unsubscribeUrl = registeredRecipient && contact.userId
        ? `${siteUrl}/email/unsubscribe?token=${encodeURIComponent(createEmailUnsubscribeToken(contact.userId))}`
        : ''
      const content = buildContent({
        subject,
        message,
        ctaLabel,
        ctaUrl,
        siteUrl,
        recipientName: contact.name,
        registeredRecipient,
        unsubscribeUrl,
      })
      return { to: contact.email, subject, html: content.html, text: content.text }
    })

    const sentCount = await sendDirectEmails({
      from,
      emails,
      idempotencyKey: `admin-update-${requestId}`,
    })

    return NextResponse.json({
      ok: true,
      recipientCount: contacts.length + skippedPreferenceCount,
      sentCount,
      skippedPreferenceCount,
      recipientMode,
    })
  } catch (error) {
    console.error('Admin Resend update email failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Could not send this update.'
    const safeMessage = /configured|recipient limit|invalid email|unsubscribe secret|EMAIL_UNSUBSCRIBE_SECRET/i.test(errorMessage)
      ? errorMessage
      : 'Could not send this update through Resend.'
    return NextResponse.json({ error: safeMessage }, { status: 500 })
  }
}
