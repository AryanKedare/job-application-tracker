'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, KeyRound, Mail } from 'lucide-react'

type Method = 'password' | 'magic-link'

export default function LoginPage() {
  const [method, setMethod] = useState<Method>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentMessage, setSentMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

  const resetFeedback = () => {
    setError(null)
    setSent(false)
    setSentMessage('')
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
        redirectTo: `${baseUrl}/auth/recovery`,
      })
      if (resetError) throw resetError
      setSentMessage('If this invited account exists, a password reset link has been sent to')
      setSent(true)
    } catch {
      setError('Could not send the reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    resetFeedback()
    const normalizedEmail = email.trim().toLowerCase()

    if (method === 'password' && password.length < 12) {
      setError('Use your password with at least 12 characters.')
      return
    }

    setLoading(true)
    try {
      if (method === 'magic-link') {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: `${baseUrl}/auth/callback`,
            shouldCreateUser: false,
          },
        })
        if (authError) throw authError
        setSentMessage('If this invited account exists, a secure sign-in link has been sent to')
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
      setError('Authentication failed. Check your details or ask the administrator for an invitation.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
        <div className="w-full max-w-md text-center space-y-4 bg-slate-900/70 rounded-2xl border border-slate-800 p-10">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-slate-400 text-sm">
            {sentMessage} <span className="text-slate-200 font-medium">{email}</span>.
          </p>
          <button type="button" onClick={() => setSent(false)} className="text-xs text-slate-400 hover:text-white underline">
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            {method === 'password' ? <KeyRound className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Job Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Invitation-only access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-slate-900/70 rounded-2xl border border-slate-800 p-8">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-1">
            <button type="button" onClick={() => { setMethod('password'); resetFeedback() }} className={`rounded-lg py-2 text-xs font-semibold ${method === 'password' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
              Password
            </button>
            <button type="button" onClick={() => { setMethod('magic-link'); resetFeedback() }} className={`rounded-lg py-2 text-xs font-semibold ${method === 'magic-link' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
              Magic link
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="bg-slate-800 border-slate-700" />
          </div>

          {method === 'password' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={handleForgotPassword} disabled={loading} className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50">
                  Forgot password?
                </button>
              </div>
              <Input id="password" type="password" required minLength={12} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="bg-slate-800 border-slate-700" />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-semibold">
            {loading ? 'Please wait…' : method === 'magic-link' ? 'Send magic link' : 'Sign in'}
          </Button>

          <p className="text-center text-xs text-slate-500">Need access? Ask the administrator to invite your email address.</p>
        </form>
      </div>
    </div>
  )
}
