'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, KeyRound, LogOut, Mail, RefreshCw, Search, Send, Ticket, Trash2, UserPlus, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatLocalDateTime } from '@/lib/date'

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
interface GeneratedInvite { code: string; expiresAt: number }

export default function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalJobs: 0, activeUsers: 0, averageJobs: 0 })
  const [query, setQuery] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null)
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

  const generateInviteCode = async () => {
    setBusy('invite-code')
    setMessage(null)
    try {
      const response = await fetch('/api/admin/invite-code', { method: 'POST' })
      const result = await response.json() as { code?: string; expiresAt?: number; error?: string }
      if (!response.ok || !result.code || !result.expiresAt) throw new Error(result.error || 'Could not generate invite code.')
      setGeneratedInvite({ code: result.code, expiresAt: result.expiresAt })
      setMessage({ text: 'Single-use invite code generated.', error: false })
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Could not generate invite code.', error: true })
    } finally {
      setBusy('')
    }
  }

  const copyInviteCode = async () => {
    if (!generatedInvite) return
    try {
      await navigator.clipboard.writeText(generatedInvite.code)
      setMessage({ text: 'Invite code copied.', error: false })
    } catch {
      setMessage({ text: 'Could not copy automatically. Select and copy the code manually.', error: true })
    }
  }

  const inviteUser = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy('invite')
    setMessage(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', name: inviteName, email: inviteEmail }),
      })
      const result = await response.json() as { error?: string; magicLinkSent?: boolean }
      if (!response.ok) throw new Error(result.error || 'Invitation failed.')
      setMessage({
        text: result.magicLinkSent === false
          ? 'Invitation sent. The account was created, but the separate magic-link email could not be sent.'
          : 'Invitation sent with a password-setup link and a separate magic-login link.',
        error: false,
      })
      setInviteName('')
      setInviteEmail('')
      await load()
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Invitation failed.', error: true })
    } finally {
      setBusy('')
    }
  }

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
      setMessage({ text: action === 'recovery' ? 'Password recovery email sent. Ask the user to check spam or junk if it does not arrive.' : 'Magic link sent. Ask the user to check spam or junk if it does not arrive.', error: false })
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

        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-500/15 p-2"><Ticket className="h-5 w-5 text-blue-300" /></div>
              <div><h2 className="font-bold">Generate invite code</h2><p className="text-sm text-slate-400">Share a single-use code so a new user can enter their own name and email. Each code expires after 15 minutes.</p></div>
            </div>
            <Button onClick={() => void generateInviteCode()} disabled={!!busy} className="bg-blue-600 hover:bg-blue-500"><Ticket className="h-4 w-4 mr-2" />{busy === 'invite-code' ? 'Generating…' : 'Generate code'}</Button>
          </div>
          {generatedInvite && <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-slate-500">Single-use invite code</p><p className="mt-1 break-all font-mono text-sm font-bold text-blue-200">{generatedInvite.code}</p><p className="mt-2 text-xs text-slate-500">Expires {formatLocalDateTime(generatedInvite.expiresAt)}</p></div>
              <Button size="sm" variant="outline" onClick={() => void copyInviteCode()}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
            </div>
          </div>}
        </section>

        <section className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-xl bg-violet-500/15 p-2"><UserPlus className="h-5 w-5 text-violet-300" /></div>
            <div><h2 className="font-bold">Invite a user directly</h2><p className="text-sm text-slate-400">Creates an invite-only account and sends password setup plus magic-login emails.</p></div>
          </div>
          <form onSubmit={inviteUser} className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
            <div className="space-y-2"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" required maxLength={100} value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Jane Doe" className="bg-slate-950 border-slate-700" /></div>
            <div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="jane@example.com" className="bg-slate-950 border-slate-700" /></div>
            <Button disabled={!!busy} className="bg-violet-600 hover:bg-violet-500"><Send className="h-4 w-4 mr-2" />{busy === 'invite' ? 'Sending…' : 'Send invite'}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="border-b border-slate-800 p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" className="pl-9 bg-slate-950 border-slate-700" /></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-900 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Jobs</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Last sign-in</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">
            {visibleUsers.map((user) => <tr key={user.id} className="hover:bg-slate-800/30"><td className="px-4 py-3"><Input value={user.name} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, name: event.target.value } : item))} className="bg-slate-950 border-slate-700" /></td><td className="px-4 py-3"><Input type="email" value={user.email} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, email: event.target.value } : item))} className="bg-slate-950 border-slate-700" /></td><td className="px-4 py-3 font-bold text-violet-300">{user.jobCount}</td><td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatLocalDateTime(user.createdAt)}</td><td className="px-4 py-3 text-slate-400 whitespace-nowrap">{user.lastSignInAt ? formatLocalDateTime(user.lastSignInAt) : 'Never'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void updateUser(user)} disabled={!!busy}>Save</Button><Button size="sm" variant="outline" onClick={() => void sendEmail(user, 'recovery')} disabled={!!busy}><KeyRound className="h-3.5 w-3.5 mr-1" />Recovery</Button><Button size="sm" variant="outline" onClick={() => void sendEmail(user, 'magic-link')} disabled={!!busy}><Send className="h-3.5 w-3.5 mr-1" />Magic link</Button><Button size="sm" variant="outline" className="text-red-300 hover:text-red-200" onClick={() => void deleteUser(user)} disabled={!!busy}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button></div></td></tr>)}
            {!loading && visibleUsers.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No users found.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
    </main>
  )
}
