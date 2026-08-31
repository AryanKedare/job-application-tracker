'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, FileText, Briefcase, TrendingUp, Trophy, XCircle, Ghost, Bookmark, LogOut, Pencil, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'

const STATUS_CONFIG: {
  key: JobApplication['status']
  label: string
  icon: React.ReactNode
  color: string
  bg: string
}[] = [
  { key: 'Applied', label: 'Applied', icon: <Briefcase className="h-4 w-4" />, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
  { key: 'Interviewing', label: 'Interviewing', icon: <TrendingUp className="h-4 w-4" />, color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { key: 'Offer', label: 'Offer', icon: <Trophy className="h-4 w-4" />, color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { key: 'Rejected', label: 'Rejected', icon: <XCircle className="h-4 w-4" />, color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/20' },
  { key: 'Ghosted', label: 'Ghosted', icon: <Ghost className="h-4 w-4" />, color: 'text-slate-400', bg: 'bg-slate-800/70 border-slate-700/60' },
  { key: 'Bookmarked', label: 'Saved', icon: <Bookmark className="h-4 w-4" />, color: 'text-slate-300', bg: 'bg-slate-800/70 border-slate-700/60' },
]

export default function Home() {
  const router = useRouter()
  const [stats, setStats] = useState<Partial<Record<JobApplication['status'], number>>>({})
  const [total, setTotal] = useState<number | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [hasRealName, setHasRealName] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        setFeedback({ text: 'Could not check your account session.', error: true })
        return
      }
      if (!user) return

      setLoggedIn(true)
      const realName = user.user_metadata?.full_name || user.user_metadata?.name || null
      setHasRealName(Boolean(realName))
      setUserName(realName ?? user.email?.split('@')[0] ?? null)

      const { data, error } = await supabase
        .from('job_applications')
        .select('status')
        .eq('user_id', user.id)

      if (error) {
        setFeedback({ text: 'Could not load your application statistics.', error: true })
        return
      }

      setTotal(data?.length ?? 0)
      const counts: Partial<Record<JobApplication['status'], number>> = {}
      for (const row of data ?? []) {
        const status = row.status as JobApplication['status']
        counts[status] = (counts[status] ?? 0) + 1
      }
      setStats(counts)
    }
    void loadData()
  }, [])

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setFeedback({ text: 'Could not sign you out. Please try again.', error: true })
      return
    }
    setLoggedIn(false)
    setUserName(null)
    setTotal(null)
    setStats({})
    setFeedback({ text: 'Signed out successfully.', error: false })
    router.refresh()
  }

  const handleSaveName = async () => {
    const nextName = nameInput.trim()
    if (!nextName) {
      setFeedback({ text: 'Enter your name before saving.', error: true })
      return
    }

    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nextName } })
    setSavingName(false)
    if (error) {
      setFeedback({ text: 'Could not update your name.', error: true })
      return
    }

    setUserName(nextName)
    setHasRealName(true)
    setEditingName(false)
    setFeedback({ text: 'Name updated.', error: false })
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex min-h-10 flex-wrap items-center justify-end gap-3">
          {loggedIn ? (
            <>
              {editingName ? (
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    autoFocus
                    aria-label="Your name"
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleSaveName()
                      if (event.key === 'Escape') setEditingName(false)
                    }}
                    className="h-9 min-w-0 w-40 bg-slate-900 border-slate-700"
                  />
                  <button type="button" onClick={() => void handleSaveName()} disabled={savingName} aria-label="Save name" className="rounded-md p-2 text-emerald-400 hover:bg-slate-900 hover:text-emerald-300">
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm text-slate-300">{userName ? `Hi, ${userName}` : 'Signed in'}</span>
                  {!hasRealName && (
                    <button type="button" onClick={() => { setEditingName(true); setNameInput('') }} aria-label="Set your name" className="rounded-md p-2 text-slate-500 hover:bg-slate-900 hover:text-slate-300">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <button type="button" onClick={() => void handleSignOut()} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </header>

        {feedback && (
          <div role={feedback.error ? 'alert' : 'status'} className={`mb-6 rounded-xl border px-4 py-3 text-sm ${feedback.error ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>
            {feedback.text}
          </div>
        )}

        <section className="mb-10 text-center sm:mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl md:text-6xl">Job Tracker</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">Track applications, interview stages, resumes, notes, and outcomes.</p>
        </section>

        <section className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2 sm:mb-16">
          <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/75 p-5 sm:p-8">
            <FileText className="mx-auto mb-5 h-10 w-10 text-blue-400" />
            <h2 className="text-center text-xl font-semibold">Applications</h2>
            <p className="mb-6 mt-2 flex-1 text-center text-sm text-slate-400">Manage every application and its interview lifecycle.</p>
            <Button asChild size="lg" className="h-12 w-full bg-blue-600 hover:bg-blue-500">
              <Link href="/jobs">Open dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/75 p-5 sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Progress</h2>
              {total !== null && <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-400">{total} total</span>}
            </div>

            {!loggedIn ? (
              <div className="flex flex-1 items-center justify-center py-6">
                <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Link href="/login">Sign in to view progress</Link>
                </Button>
              </div>
            ) : total === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center">
                <Briefcase className="h-8 w-8 text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-300">No applications yet</p>
                <Button asChild size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-500">
                  <Link href="/jobs">Add your first application</Link>
                </Button>
              </div>
            ) : (
              <div className="grid flex-1 grid-cols-2 gap-3 content-start">
                {STATUS_CONFIG.map(({ key, label, icon, color, bg }) => (
                  <div key={key} className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 sm:px-4 ${bg}`}>
                    <span className={color}>{icon}</span>
                    <div className="min-w-0">
                      <div className={`text-lg font-semibold leading-none ${color}`}>{stats[key] ?? 0}</div>
                      <div className="mt-1 truncate text-xs text-slate-400">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
