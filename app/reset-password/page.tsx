'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, KeyRound } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

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
            <Input
              id="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-semibold">
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
