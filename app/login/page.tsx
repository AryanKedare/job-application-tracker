'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${baseUrl}/jobs`,
      },
    })

    setLoading(false)

    if (!error) {
      alert('Check your email for the login link.')
    } else {
      console.error(error)
      alert('Error sending magic link.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-6 bg-slate-900/70 rounded-2xl border border-slate-800 p-8"
      >
        <h1 className="text-2xl font-bold mb-2">Sign in</h1>
        <p className="text-sm text-slate-400">
          A magic link will be sent to your email.
        </p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Sending…' : 'Send magic link'}
        </Button>
      </form>
    </div>
  )
}
