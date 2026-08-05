'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Login failed.')
      router.replace('/admin')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-violet-300" />
          </div>
          <h1 className="text-3xl font-black">Admin portal</h1>
          <p className="text-sm text-slate-400 mt-2">Manage Job Tracker users and account data.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Admin email</Label>
            <Input id="admin-email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="bg-slate-950 border-slate-700" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input id="admin-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="bg-slate-950 border-slate-700" />
          </div>
          {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <Button disabled={loading} className="w-full h-11 bg-violet-600 hover:bg-violet-500">
            <KeyRound className="h-4 w-4 mr-2" /> {loading ? 'Signing in…' : 'Sign in as admin'}
          </Button>
        </form>
      </div>
    </main>
  )
}
