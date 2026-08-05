'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, KeyRound } from 'lucide-react'

const RECOVERY_TYPES = new Set<EmailOtpType>(['recovery', 'invite'])

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const finish = () => {
      if (cancelled) return
      setHasRecoverySession(true)
      setCheckingSession(false)
      window.history.replaceState({}, '', '/reset-password')
    }

    const fail = () => {
      if (cancelled) return
      setHasRecoverySession(false)
      setCheckingSession(false)
      setError('This password reset link is invalid or has expired. Request a new one from the sign-in page.')
    }

    const processRecoveryLink = async () => {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const rawType = url.searchParams.get('type') ?? hash.get('type')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!sessionError) return finish()
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!exchangeError) return finish()
      }

      if (tokenHash && rawType && RECOVERY_TYPES.has(rawType as EmailOtpType)) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: rawType as EmailOtpType,
        })
        if (!otpError) return finish()
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!sessionError && data.session) return finish()

      fail()
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) finish()
    })

    void processRecoveryLink()

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!hasRecoverySession) {
      setError('Open a valid password reset email before setting a new password.')
      return
    }
    if (password.length < 12) {
      setError('Use a password with at least 12 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
    } catch {
      setError('This reset link may have expired. Request a new one from the sign-in page.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <p className="text-sm text-slate-300">Verifying your password reset link…</p>
        </div>
      </main>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
        <div className="w-full max-w-md text-center space-y-4 bg-slate-900/70 rounded-2xl border border-slate-800 p-10">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-bold">Password updated</h1>
          <p className="text-sm text-slate-400">Your new password is ready to use.</p>
          <Button onClick={() => router.replace('/jobs')} className="w-full bg-blue-600 hover:bg-blue-700">
            Continue to applications
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Set a new password
          </h1>
          <p className="text-slate-400 text-sm mt-1">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-slate-900/70 rounded-2xl border border-slate-800 p-8">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" required minLength={12} autoComplete="new-password" disabled={!hasRecoverySession} value={password} onChange={(event) => setPassword(event.target.value)} className="bg-slate-800 border-slate-700" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" required minLength={12} autoComplete="new-password" disabled={!hasRecoverySession} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="bg-slate-800 border-slate-700" />
          </div>

          {error && <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" disabled={loading || !hasRecoverySession} className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-semibold">
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
