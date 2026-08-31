'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, KeyRound, Mail, UserPlus } from 'lucide-react'

type Method = 'password' | 'magic-link'
type View = 'signin' | 'invite-code' | 'invite-details'

const ACCESS_REQUEST_EMAIL = process.env.NEXT_PUBLIC_ACCESS_REQUEST_EMAIL?.trim()

function currentOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

function accessRequestHref(recipient: string, requesterEmail: string): string {
  const subject = 'Access request - Job Application Tracker'
  const body = [
    'Hello,',
    '',
    "I'd like to request access to Job Application Tracker.",
    '',
    'Name:',
    `Email: ${requesterEmail}`,
    'Reason for access:',
    '',
    'Thanks.',
  ].join('\n')

  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function LoginPage() {
  const [method, setMethod] = useState<Method>('password')
  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentMessage, setSentMessage] = useState('')
  const [sentEmail, setSentEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const resetFeedback = () => {
    setError(null)
    setNotice(null)
    setSent(false)
    setSentMessage('')
    setSentEmail('')
  }

  const handleForgotPassword = async () => {
    resetFeedback()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Enter your email address first.')
      return
    }

    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${currentOrigin()}/reset-password?recovery=1`,
      })
      if (resetError) throw resetError
      setSentMessage('A password reset link has been sent to')
      setSentEmail(normalizedEmail)
      setSent(true)
    } catch {
      setError('Could not send the password reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestAccess = async () => {
    resetFeedback()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Enter your email address before requesting access.')
      return
    }
    if (!ACCESS_REQUEST_EMAIL) {
      setError('Access requests are not configured for this deployment.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const result = await response.json() as { exists?: boolean; error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not check this email address.')

      if (result.exists) {
        setMethod('password')
        setNotice('An account already exists for this email. Sign in with your credentials, or reset your password if you no longer remember it.')
        return
      }

      window.location.href = accessRequestHref(ACCESS_REQUEST_EMAIL, normalizedEmail)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not check this email address.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Enter your email address.')
      return
    }
    if (method === 'password' && password.length < 12) {
      setError('Enter your password. Passwords are at least 12 characters.')
      return
    }

    setLoading(true)
    try {
      if (method === 'magic-link') {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: `${currentOrigin()}/auth/callback`,
            shouldCreateUser: false,
          },
        })
        if (authError) throw authError
        setSentMessage('A secure sign-in link has been sent to')
        setSentEmail(normalizedEmail)
        setSent(true)
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (authError) throw authError
      window.location.assign('/jobs')
    } catch {
      setError('Sign-in failed. Check your email and password, or reset your password.')
    } finally {
      setLoading(false)
    }
  }

  const validateInviteCode = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    const code = inviteCode.trim().toUpperCase()
    if (!code) {
      setError('Enter your invite code.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', code }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Invalid invite code.')
      setInviteCode(code)
      setView('invite-details')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This invite code is invalid or has expired.')
    } finally {
      setLoading(false)
    }
  }

  const redeemInviteCode = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    const normalizedEmail = inviteEmail.trim().toLowerCase()
    const name = inviteName.trim()
    if (!name) {
      setError('Enter your name.')
      return
    }
    if (!normalizedEmail) {
      setError('Enter your email address.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redeem', code: inviteCode, name, email: normalizedEmail }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not complete the invitation.')
      setSentMessage('A password setup link has been sent to')
      setSentEmail(normalizedEmail)
      setSent(true)
      setView('signin')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete the invitation.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 flex items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-400" />
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-sm text-slate-300">{sentMessage} <span className="font-semibold text-slate-100 break-all">{sentEmail}</span>.</p>
          <button type="button" onClick={() => { setSent(false); setView('signin') }} className="text-sm font-medium text-blue-400 hover:text-blue-300">Back to sign in</button>
        </section>
      </main>
    )
  }

  if (view === 'invite-code') {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 flex items-center justify-center">
        <div className="w-full max-w-md">
          <header className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600"><UserPlus className="h-6 w-6" /></div>
            <h1 className="text-3xl font-black">Join Job Tracker</h1>
            <p className="mt-1 text-sm text-slate-400">Enter the invite code you received.</p>
          </header>
          <form onSubmit={validateInviteCode} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-8">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input id="invite-code" required autoComplete="off" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} className="bg-slate-800 border-slate-700 font-mono" />
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
            <Button type="submit" disabled={loading} className="h-11 w-full bg-violet-600 hover:bg-violet-700 font-semibold">{loading ? 'Checking…' : 'Continue'}</Button>
            <button type="button" onClick={() => { setView('signin'); resetFeedback() }} className="w-full text-sm font-medium text-slate-400 hover:text-white">Back to sign in</button>
          </form>
        </div>
      </main>
    )
  }

  if (view === 'invite-details') {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 flex items-center justify-center">
        <div className="w-full max-w-md">
          <header className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600"><CheckCircle2 className="h-6 w-6" /></div>
            <h1 className="text-3xl font-black">Invite accepted</h1>
            <p className="mt-1 text-sm text-slate-400">Add your details to receive a password setup link.</p>
          </header>
          <form onSubmit={redeemInviteCode} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-8">
            <div className="space-y-2"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" required maxLength={100} autoComplete="name" value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="bg-slate-800 border-slate-700" /></div>
            <div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" required maxLength={254} autoComplete="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="bg-slate-800 border-slate-700" /></div>
            {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
            <Button type="submit" disabled={loading} className="h-11 w-full bg-emerald-600 hover:bg-emerald-700 font-semibold">{loading ? 'Sending…' : 'Send password setup link'}</Button>
            <button type="button" onClick={() => { setView('invite-code'); resetFeedback() }} className="w-full text-sm font-medium text-slate-400 hover:text-white">Use a different invite code</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 flex items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
            {method === 'password' ? <KeyRound className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Job Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">Invitation-only access</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-8">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-1">
            <button type="button" onClick={() => { setMethod('password'); resetFeedback() }} className={`rounded-lg py-2 text-xs font-semibold ${method === 'password' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Password</button>
            <button type="button" onClick={() => { setMethod('magic-link'); resetFeedback() }} className={`rounded-lg py-2 text-xs font-semibold ${method === 'magic-link' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Magic link</button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setNotice(null); setError(null) }} className="bg-slate-800 border-slate-700" />
          </div>

          {method === 'password' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={handleForgotPassword} disabled={loading} className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50">Forgot password?</button>
              </div>
              <Input id="password" type="password" required minLength={12} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="bg-slate-800 border-slate-700" />
            </div>
          )}

          {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {notice && (
            <div role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200 space-y-3">
              <p>{notice}</p>
              <Button type="button" size="sm" variant="outline" onClick={handleForgotPassword} disabled={loading} className="border-emerald-500/30 text-emerald-200">Reset password</Button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="h-11 w-full bg-blue-600 hover:bg-blue-700 font-semibold">
            {loading ? 'Please wait…' : method === 'magic-link' ? 'Send magic link' : 'Sign in'}
          </Button>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => { setView('invite-code'); resetFeedback() }} className="border-slate-700 text-violet-300">Use invite code</Button>
            {ACCESS_REQUEST_EMAIL && <Button type="button" variant="outline" onClick={handleRequestAccess} disabled={loading} className="border-slate-700 text-emerald-300"><Mail className="mr-2 h-4 w-4" />Request access</Button>}
          </div>
        </form>
      </div>
    </main>
  )
}
