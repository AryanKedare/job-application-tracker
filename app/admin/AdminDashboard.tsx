'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, LogOut, Mail, RefreshCw, Search, Send, Trash2, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AdminUser {
  id: string
  email: string
  name: string
  createdAt: string
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  jobCount: number
}

interface Stats { totalUsers: number; totalJobs: number; activeUsers: number; averageJobs: number }

export default function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalJobs: 0, activeUsers: 0, averageJobs: 0 })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' })
      if (response.status === 401) { router.replace('/admin/login'); return }
      const result = await response.json() as { users?: AdminUser[]; stats?: Stats; error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not load data.')
      setUsers(result.users ?? [])
      setStats(result.stats ?? stats)
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Could not load data.', error: true })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(needle)) : users
  }, [query, users])

  const updateUser = async (user: AdminUser) => {
    setBusy(`update:${user.id}`)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: user.name, email: user.email }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Update failed.')
      setMessage({ text: 'User updated.', error: false })
      await load()
    } catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : 'Update failed.', error: true }) }
    finally { setBusy('') }
  }

  const sendEmail = async (user: AdminUser, action: 'recovery' | 'magic-link') => {
    setBusy(`${action}:${user.id}`)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, email: user.email }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Email failed.')
      setMessage({ text: action === 'recovery' ? 'Password recovery email sent.' : 'Magic link sent.', error: false })
    } catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : 'Email failed.', error: true }) }
    finally { setBusy('') }
  }

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.email}, all job applications, and stored CVs? This cannot be undone.`)) return
    setBusy(`delete:${user.id}`)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Deletion failed.')
      setMessage({ text: 'Account and associated data deleted.', error: false })
      await load()
    } catch (reason) { setMessage({ text: reason instanceof Error ? reason.message : 'Deletion failed.', error: true }) }
    finally { setBusy('') }
  }

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.replace('/admin/login')
    router.refresh()
  }

  const cards = [
    ['Total users', stats.totalUsers, Users], ['Total applications', stats.totalJobs, KeyRound],
    ['Users with jobs', stats.activeUsers, UserRound], ['Average jobs/user', stats.averageJobs, Mail],
  ] as const

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-violet-300">Administration</p><h1 className="text-3xl font-black">Job Tracker users</h1></div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button variant="outline" onClick={logout}><LogOut className="h-4 w-4 mr-2" />Sign out</Button></div>
        </header>

        {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>{message.text}</div>}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><Icon className="h-5 w-5 text-violet-300 mb-4" /><div className="text-2xl font-black">{value}</div><div className="text-xs text-slate-400 mt-1">{label}</div></div>)}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="border-b border-slate-800 p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="pl-9 bg-slate-950 border-slate-700" /></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-900 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Jobs</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Last sign-in</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">
            {visibleUsers.map((user, index) => <tr key={user.id} className="hover:bg-slate-800/30"><td className="px-4 py-3"><Input value={user.name} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, name: event.target.value } : item))} className="bg-slate-950 border-slate-700" /></td><td className="px-4 py-3"><Input type="email" value={user.email} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, email: event.target.value } : item))} className="bg-slate-950 border-slate-700" /></td><td className="px-4 py-3 font-bold text-violet-300">{user.jobCount}</td><td className="px-4 py-3 text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-4 py-3 text-slate-400">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : 'Never'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void updateUser(user)} disabled={!!busy}>Save</Button><Button size="sm" variant="outline" onClick={() => void sendEmail(user, 'recovery')} disabled={!!busy}><KeyRound className="h-3.5 w-3.5 mr-1" />Recovery</Button><Button size="sm" variant="outline" onClick={() => void sendEmail(user, 'magic-link')} disabled={!!busy}><Send className="h-3.5 w-3.5 mr-1" />Magic link</Button><Button size="sm" variant="outline" className="text-red-300 hover:text-red-200" onClick={() => void deleteUser(user)} disabled={!!busy}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button></div></td></tr>)}
            {!loading && visibleUsers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No users found.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
    </main>
  )
}
