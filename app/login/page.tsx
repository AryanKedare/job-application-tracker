'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, CheckCircle2 } from 'lucide-react'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${baseUrl}/auth/callback`,
        data: mode === 'signup' ? { full_name: name.trim() } : undefined,
      },
    })

    setLoading(false)

    if (otpError) {
      setError('Failed to send magic link. Please try again.')
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
        <div className="w-full max-w-md text-center space-y-4 bg-slate-900/70 rounded-2xl border border-slate-800 p-10">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-slate-400 text-sm">
            We sent a magic link to <span className="text-slate-200 font-medium">{email}</span>.
            Click it to {mode === 'signup' ? 'create your account' : 'sign in'}.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(''); setName('') }}
            className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 mt-2"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-md">

        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Job Tracker
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-slate-900/70 rounded-2xl border border-slate-800 p-8"
        >
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-slate-700 text-sm font-medium">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null) }}
              className={`flex-1 py-2 transition-colors ${
                mode === 'signin'
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null) }}
              className={`flex-1 py-2 transition-colors ${
                mode === 'signup'
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign up
            </button>
          </div>

          {/* Name field — sign up only */}
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g. Aryan Kedare"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-800 border-slate-700"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {loading ? 'Sending…' : `Send magic link`}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            We&apos;ll email you a secure link — no password needed.
          </p>
        </form>
      </div>
    </div>
  )
}
