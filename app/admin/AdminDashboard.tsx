'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, KeyRound, LogOut, Mail, Megaphone, RefreshCw, Search, Send, Ticket, Trash2, UserPlus, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
type RecipientMode = 'all' | 'selected' | 'custom'

export default function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalJobs: 0, activeUsers: 0, averageJobs: 0 })
  const [query, setQuery] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null)
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState('')
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState('')
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [customRecipients, setCustomRecipients] = useState('')
  const [recipientSearch, setRecipientSearch] = useState('')
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
      setStats(result.stats ?? { totalUsers: 0, totalJobs: 0, activeUsers: 0, averageJobs: 0 })
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

  const confirmedUsers = useMemo(
    () => users.filter((user) => Boolean(user.email && user.emailConfirmedAt)),
    [users],
  )

  const confirmedRecipientCount = confirmedUsers.length

  const selectableUsers = useMemo(() => {
    const needle = recipientSearch.trim().toLowerCase()
    return needle
      ? confirmedUsers.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(needle))
      : confirmedUsers
  }, [confirmedUsers, recipientSearch])

  const customRecipientCount = useMemo(() => {
    const emails = customRecipients
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
    return new Set(emails).size
  }, [customRecipients])

  const selectedRecipientCount = selectedUserIds.length
  const currentRecipientCount = recipientMode === 'all'
    ? confirmedRecipientCount
    : recipientMode === 'selected'
      ? selectedRecipientCount
      : customRecipientCount

  const generateInviteCode = async () => {
    setBusy('invite-code')
    setMessage(null)
    try {
      const response = await fetch('/api/admin/invite-code', { method: 'POST' })
      const result = await response.json() as { code?: string; expiresAt?: number; error?: string }
      if (!response.ok || !result.code || !result.expiresAt) throw new Error(result.error || 'Could not generate invite code.')
      setGeneratedInvite({ code: result.code, expiresAt: result.expiresAt })
      setMessage({ text: 'Invite code generated.', error: false })
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
      setMessage({ text: 'Could not copy the invite code.', error: true })
    }
  }

  const inviteUser = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setMessage({ text: 'Enter a name and email address.', error: true })
      return
    }

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
      setMessage({ text: result.magicLinkSent === false ? 'Invitation sent. The additional magic link could not be sent.' : 'Invitation sent.', error: false })
      setInviteName('')
      setInviteEmail('')
      await load()
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Invitation failed.', error: true })
    } finally {
      setBusy('')
    }
  }

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId])
  }

  const selectAllVisibleRecipients = () => {
    setSelectedUserIds((current) => [...new Set([...current, ...selectableUsers.map((user) => user.id)])])
  }

  const clearBroadcastForm = () => {
    setBroadcastSubject('')
    setBroadcastMessage('')
    setBroadcastCtaLabel('')
    setBroadcastCtaUrl('')
    setSelectedUserIds([])
    setCustomRecipients('')
    setRecipientSearch('')
  }

  const sendBroadcastUpdate = async (action: 'test' | 'send') => {
    const subject = broadcastSubject.trim()
    const body = broadcastMessage.trim()
    const ctaLabel = broadcastCtaLabel.trim()
    const ctaUrl = broadcastCtaUrl.trim()

    if (!subject || !body) {
      setMessage({ text: 'Enter an email subject and message.', error: true })
      return
    }
    if (Boolean(ctaLabel) !== Boolean(ctaUrl)) {
      setMessage({ text: 'Provide both a button label and URL, or leave both empty.', error: true })
      return
    }

    if (action === 'send') {
      if (!currentRecipientCount) {
        const text = recipientMode === 'selected'
          ? 'Select at least one confirmed user.'
          : recipientMode === 'custom'
            ? 'Enter at least one custom email address.'
            : 'There are no confirmed users to email.'
        setMessage({ text, error: true })
        return
      }

      const confirmation = recipientMode === 'all'
        ? `Send this update directly to ${confirmedRecipientCount} confirmed user${confirmedRecipientCount === 1 ? '' : 's'}?`
        : recipientMode === 'selected'
          ? `Send this update directly to ${selectedRecipientCount} selected user${selectedRecipientCount === 1 ? '' : 's'}?`
          : `Send this one-off update directly to ${customRecipientCount} custom email address${customRecipientCount === 1 ? '' : 'es'}?`

      if (!window.confirm(confirmation)) return
    }

    setBusy(action === 'test' ? 'broadcast-test' : 'broadcast-send')
    setMessage(null)
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          recipientMode,
          selectedUserIds,
          customEmails: customRecipients,
          subject,
          message: body,
          ctaLabel,
          ctaUrl,
          requestId: crypto.randomUUID(),
        }),
      })
      if (response.status === 401) { router.replace('/admin/login'); return }
      const result = await response.json() as {
        error?: string
        recipientCount?: number
        sentCount?: number | null
      }
      if (!response.ok) throw new Error(result.error || 'Could not send this update.')

      if (action === 'test') {
        setMessage({ text: 'Test update sent to the configured admin email.', error: false })
      } else {
        const sent = result.sentCount ?? 0
        setMessage({ text: `Update sent to ${sent} recipient${sent === 1 ? '' : 's'}.`, error: false })
        clearBroadcastForm()
      }
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Could not send this update.', error: true })
    } finally {
      setBusy('')
    }
  }

  const updateUser = async (user: AdminUser) => {
    if (!user.email.trim()) {
      setMessage({ text: 'User email cannot be empty.', error: true })
      return
    }

    setBusy(`update:${user.id}`)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, name: user.name, email: user.email }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Update failed.')
      setMessage({ text: 'User updated.', error: false })
      await load()
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Update failed.', error: true })
    } finally {
      setBusy('')
    }
  }

  const sendEmail = async (user: AdminUser, action: 'recovery' | 'magic-link') => {
    setBusy(`${action}:${user.id}`)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email: user.email }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Email failed.')
      setMessage({ text: action === 'recovery' ? 'Password recovery email sent.' : 'Magic link sent.', error: false })
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Email failed.', error: true })
    } finally {
      setBusy('')
    }
  }

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.email}, all job applications, and stored CVs? This cannot be undone.`)) return
    setBusy(`delete:${user.id}`)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Deletion failed.')
      setMessage({ text: 'Account and associated data deleted.', error: false })
      await load()
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Deletion failed.', error: true })
    } finally {
      setBusy('')
    }
  }

  const logout = async () => {
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Could not sign out.')
      router.replace('/admin/login')
      router.refresh()
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'Could not sign out.', error: true })
    }
  }

  const cards = [
    ['Total users', stats.totalUsers, Users],
    ['Total applications', stats.totalJobs, KeyRound],
    ['Users with jobs', stats.activeUsers, UserRound],
    ['Average jobs/user', stats.averageJobs, Mail],
  ] as const

  const sendButtonLabel = recipientMode === 'all'
    ? `Send update to ${confirmedRecipientCount}`
    : recipientMode === 'selected'
      ? `Send to ${selectedRecipientCount} selected`
      : `Send to ${customRecipientCount} custom`

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-violet-300">Administration</p><h1 className="text-3xl font-black">Users</h1></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button variant="outline" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div>
        </header>

        {message && <div role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${message.error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>{message.text}</div>}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([label, value, Icon]) => <div key={label} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5"><Icon className="mb-3 h-5 w-5 text-violet-300" /><div className="text-2xl font-black">{value}</div><div className="mt-1 truncate text-xs text-slate-400">{label}</div></div>)}
        </section>

        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-blue-500/15 p-2"><Ticket className="h-5 w-5 text-blue-300" /></div><h2 className="font-bold">Invite code</h2></div>
            <Button onClick={() => void generateInviteCode()} disabled={Boolean(busy)} className="bg-blue-600 hover:bg-blue-500"><Ticket className="mr-2 h-4 w-4" />{busy === 'invite-code' ? 'Generating…' : 'Generate code'}</Button>
          </div>
          {generatedInvite && <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all font-mono text-sm font-bold text-blue-200">{generatedInvite.code}</p><p className="mt-2 text-xs text-slate-500">Expires {formatLocalDateTime(generatedInvite.expiresAt)}</p></div><Button size="sm" variant="outline" onClick={() => void copyInviteCode()}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</Button></div></div>}
        </section>

        <section className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-violet-500/15 p-2"><UserPlus className="h-5 w-5 text-violet-300" /></div><h2 className="font-bold">Invite user</h2></div>
          <form onSubmit={inviteUser} className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
            <div className="space-y-2"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" required maxLength={100} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="bg-slate-950 border-slate-700" /></div>
            <div className="space-y-2"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" required maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="bg-slate-950 border-slate-700" /></div>
            <Button disabled={Boolean(busy)} className="bg-violet-600 hover:bg-violet-500"><Send className="mr-2 h-4 w-4" />{busy === 'invite' ? 'Sending…' : 'Send invite'}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/15 p-2"><Megaphone className="h-5 w-5 text-emerald-300" /></div><div><h2 className="font-bold">Product update email</h2><p className="text-xs text-slate-500">Choose the audience before sending</p></div></div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button type="button" variant={recipientMode === 'all' ? 'default' : 'outline'} onClick={() => setRecipientMode('all')} disabled={Boolean(busy)}>
                  All users ({confirmedRecipientCount})
                </Button>
                <Button type="button" variant={recipientMode === 'selected' ? 'default' : 'outline'} onClick={() => setRecipientMode('selected')} disabled={Boolean(busy)}>
                  Selected ({selectedRecipientCount})
                </Button>
                <Button type="button" variant={recipientMode === 'custom' ? 'default' : 'outline'} onClick={() => setRecipientMode('custom')} disabled={Boolean(busy)}>
                  Custom ({customRecipientCount})
                </Button>
              </div>
            </div>

            {recipientMode === 'all' && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
                The update will be sent directly to confirmed Job Tracker users from Supabase Auth. Resend is used only for delivery.
              </div>
            )}

            {recipientMode === 'selected' && (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="w-full max-w-md space-y-2"><Label htmlFor="recipient-search">Find users</Label><Input id="recipient-search" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} className="border-slate-700 bg-slate-950" /></div>
                  <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={selectAllVisibleRecipients} disabled={!selectableUsers.length}>Select visible</Button><Button type="button" size="sm" variant="outline" onClick={() => setSelectedUserIds([])} disabled={!selectedRecipientCount}>Clear</Button></div>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {selectableUsers.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-500">No confirmed users found.</div>
                  ) : selectableUsers.map((user) => (
                    <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 hover:border-slate-700">
                      <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelectedUser(user.id)} className="h-4 w-4 accent-emerald-500" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-200">{user.name || 'Unnamed user'}</span><span className="block truncate text-xs text-slate-500">{user.email}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {recipientMode === 'custom' && (
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <Label htmlFor="custom-recipients">Custom email addresses</Label>
                <Textarea id="custom-recipients" value={customRecipients} onChange={(event) => setCustomRecipients(event.target.value)} rows={5} maxLength={100000} className="resize-y border-slate-700 bg-slate-950" />
                <p className="text-xs text-slate-500">Enter addresses separated by a new line, comma, semicolon, or space. These are one-off direct emails and are not added to a Job Tracker user list.</p>
              </div>
            )}

            <div className="space-y-2"><Label htmlFor="broadcast-subject">Subject</Label><Input id="broadcast-subject" maxLength={140} value={broadcastSubject} onChange={(event) => setBroadcastSubject(event.target.value)} className="border-slate-700 bg-slate-950" /></div>
            <div className="space-y-2"><Label htmlFor="broadcast-message">Message</Label><Textarea id="broadcast-message" maxLength={10000} rows={8} value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} className="min-h-40 resize-y border-slate-700 bg-slate-950" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="broadcast-cta-label">Button label (optional)</Label><Input id="broadcast-cta-label" maxLength={80} value={broadcastCtaLabel} onChange={(event) => setBroadcastCtaLabel(event.target.value)} className="border-slate-700 bg-slate-950" /></div>
              <div className="space-y-2"><Label htmlFor="broadcast-cta-url">Button HTTPS URL (optional)</Label><Input id="broadcast-cta-url" type="url" maxLength={2048} value={broadcastCtaUrl} onChange={(event) => setBroadcastCtaUrl(event.target.value)} className="border-slate-700 bg-slate-950" /></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => void sendBroadcastUpdate('test')} disabled={Boolean(busy)}><Mail className="mr-2 h-4 w-4" />{busy === 'broadcast-test' ? 'Sending test…' : 'Send test'}</Button>
              <Button type="button" className="bg-emerald-600 hover:bg-emerald-500" onClick={() => void sendBroadcastUpdate('send')} disabled={Boolean(busy) || currentRecipientCount === 0}><Megaphone className="mr-2 h-4 w-4" />{busy === 'broadcast-send' ? 'Sending…' : sendButtonLabel}</Button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div className="max-w-md space-y-2"><Label htmlFor="user-search">Search users</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input id="user-search" value={query} onChange={(event) => setQuery(event.target.value)} className="bg-slate-950 border-slate-700 pl-9" /></div></div>

          {!loading && visibleUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">No users found.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleUsers.map((user) => (
                <article key={user.id} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="truncate font-semibold text-slate-100">{user.name || 'Unnamed user'}</h3><a href={`mailto:${user.email}`} className="block truncate text-sm text-blue-300 hover:text-blue-200">{user.email}</a></div>
                    <span className="flex-shrink-0 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-300">{user.jobCount} jobs</span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor={`name-${user.id}`}>Name</Label><Input id={`name-${user.id}`} value={user.name} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, name: event.target.value } : item))} className="bg-slate-950 border-slate-700" /></div>
                    <div className="space-y-2"><Label htmlFor={`email-${user.id}`}>Email</Label><Input id={`email-${user.id}`} type="email" value={user.email} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, email: event.target.value } : item))} className="bg-slate-950 border-slate-700" /></div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400"><div><dt className="text-slate-600">Joined</dt><dd className="mt-1 break-words">{formatLocalDateTime(user.createdAt)}</dd></div><div><dt className="text-slate-600">Last sign-in</dt><dd className="mt-1 break-words">{user.lastSignInAt ? formatLocalDateTime(user.lastSignInAt) : 'Never'}</dd></div></dl>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button size="sm" onClick={() => void updateUser(user)} disabled={Boolean(busy)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => void sendEmail(user, 'recovery')} disabled={Boolean(busy)}><KeyRound className="mr-1 h-3.5 w-3.5" />Recovery</Button>
                    <Button size="sm" variant="outline" onClick={() => void sendEmail(user, 'magic-link')} disabled={Boolean(busy)}><Send className="mr-1 h-3.5 w-3.5" />Magic link</Button>
                    <Button size="sm" variant="outline" className="text-red-300 hover:text-red-200" onClick={() => void deleteUser(user)} disabled={Boolean(busy)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
