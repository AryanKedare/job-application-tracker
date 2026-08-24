// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Check,
  ChevronRight,
  FileText,
  Github,
  Ghost,
  LogOut,
  Pencil,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'

const STATUS_CONFIG: {
  key: JobApplication['status']
  label: string
  icon: React.ReactNode
  color: string
  bg: string
}[] = [
  { key: 'Applied', label: 'Applied', icon: <Briefcase className="h-4 w-4" />, color: 'text-blue-300', bg: 'bg-blue-400/10 border-blue-300/15' },
  { key: 'Interviewing', label: 'Interviewing', icon: <TrendingUp className="h-4 w-4" />, color: 'text-amber-300', bg: 'bg-amber-400/10 border-amber-300/15' },
  { key: 'Offer', label: 'Offer', icon: <Trophy className="h-4 w-4" />, color: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-300/15' },
  { key: 'Rejected', label: 'Rejected', icon: <XCircle className="h-4 w-4" />, color: 'text-rose-300', bg: 'bg-rose-400/10 border-rose-300/15' },
  { key: 'Ghosted', label: 'Ghosted', icon: <Ghost className="h-4 w-4" />, color: 'text-slate-400', bg: 'bg-white/[0.035] border-white/[0.07]' },
  { key: 'Bookmarked', label: 'Saved', icon: <Bookmark className="h-4 w-4" />, color: 'text-slate-300', bg: 'bg-white/[0.035] border-white/[0.07]' },
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

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setLoggedIn(true)
      const realName = user.user_metadata?.full_name || user.user_metadata?.name || null
      setHasRealName(!!realName)
      setUserName(realName ?? user.email?.split('@')[0] ?? null)

      const { data } = await supabase
        .from('job_applications')
        .select('status')
        .eq('user_id', user.id)

      if (!data) return

      setTotal(data.length)
      const counts: Partial<Record<JobApplication['status'], number>> = {}
      for (const row of data) {
        const status = row.status as JobApplication['status']
        counts[status] = (counts[status] ?? 0) + 1
      }
      setStats(counts)
    }

    void loadData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setUserName(null)
    setTotal(null)
    setStats({})
    router.refresh()
  }

  const handleSaveName = async () => {
    if (!nameInput.trim()) return

    setSavingName(true)
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nameInput.trim() },
    })
    setSavingName(false)

    if (!error) {
      setUserName(nameInput.trim())
      setHasRealName(true)
      setEditingName(false)
    }
  }

  return (
    <main className="min-h-screen px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="glass-panel sticky top-3 z-20 mb-10 flex min-h-14 items-center justify-between rounded-2xl px-3 py-2 sm:px-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5" aria-label="Job Tracker home">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-blue-400 to-indigo-600 shadow-[0_8px_24px_rgba(67,111,255,0.25)]">
              <Briefcase className="h-4 w-4 text-white" />
            </span>
            <span className="text-sm font-semibold tracking-[-0.02em] text-slate-100">Job Tracker</span>
          </Link>

          {loggedIn ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleSaveName()
                      if (event.key === 'Escape') setEditingName(false)
                    }}
                    placeholder="Your name"
                    className="h-9 w-32 sm:w-40"
                  />
                  <button
                    onClick={() => void handleSaveName()}
                    disabled={savingName}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-emerald-300 transition-colors hover:bg-white/[0.07] hover:text-emerald-200 disabled:opacity-50"
                    title="Save name"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden items-center gap-1.5 sm:flex">
                  <span className="text-sm text-slate-400">
                    {userName ? <><span className="text-slate-200">{userName}</span></> : 'Signed in'}
                  </span>
                  {!hasRealName && (
                    <button
                      onClick={() => { setEditingName(true); setNameInput('') }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-slate-200"
                      title="Set your name"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={() => void handleSignOut()} className="px-2.5 text-slate-400 hover:text-white">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </header>

        <section className="mx-auto max-w-4xl pb-10 pt-5 text-center sm:pb-14 sm:pt-10">
          <div className="mx-auto mb-5 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-400">
            Applications, interviews and outcomes — together
          </div>

          <h1 className="text-balance text-[clamp(3.2rem,9vw,6.6rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
            Keep your job search
            <span className="block bg-gradient-to-r from-blue-300 via-indigo-300 to-violet-300 bg-clip-text text-transparent">clear and moving.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Track every application, resume, interview stage and note without turning your search into another spreadsheet to manage.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={loggedIn ? '/jobs' : '/login'}>
                {loggedIn ? 'Open applications' : 'Sign in to continue'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <a href="https://github.com/AryanKedare/job-application-tracker" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                View source
              </a>
            </Button>
          </div>
        </section>

        {loggedIn && !hasRealName && !editingName && (
          <section className="glass-panel mx-auto mb-6 flex max-w-4xl flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-sm font-medium text-slate-200">Make the dashboard feel more personal.</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">Add your name once and we’ll use it for the welcome message.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setEditingName(true); setNameInput('') }}>
              Set name
            </Button>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Link href="/jobs" className="group block rounded-3xl">
            <article className="glass-panel interactive-surface flex h-full min-h-[350px] flex-col overflow-hidden rounded-3xl p-6 sm:p-8">
              <div className="mb-auto flex items-start justify-between gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-400/10 text-blue-300">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.035] text-slate-500 transition-[color,background-color,transform] duration-150 group-hover:translate-x-0.5 group-hover:bg-white/[0.07] group-hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-16 max-w-xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-300/80">Workspace</p>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Your applications, without the clutter.</h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
                  Search roles, update statuses, open resumes, add interview stages and keep every detail within reach.
                </p>
              </div>
            </article>
          </Link>

          <article className="glass-panel rounded-3xl p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Progress</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">Current pipeline</h2>
              </div>
              {total !== null && (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-400">
                  {total} total
                </span>
              )}
            </div>

            {!loggedIn ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
                <p className="text-sm text-slate-400">Sign in to see your application breakdown.</p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            ) : total === 0 ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-300">Nothing tracked yet.</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Add your first application and your pipeline will appear here.</p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {STATUS_CONFIG.map(({ key, label, icon, color, bg }) => {
                  const count = stats[key] ?? 0
                  return (
                    <div key={key} className={`rounded-2xl border px-4 py-3.5 ${bg}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={color}>{icon}</span>
                        <span className={`text-2xl font-semibold tracking-[-0.04em] ${color}`}>{count}</span>
                      </div>
                      <div className="mt-5 text-xs font-medium text-slate-400">{label}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>
        </section>

        <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] px-1 py-6 text-xs text-slate-600 sm:flex-row">
          <p>Next.js · Supabase · Tailwind CSS</p>
          <p>Designed for a calmer job search.</p>
        </footer>
      </div>
    </main>
  )
}
