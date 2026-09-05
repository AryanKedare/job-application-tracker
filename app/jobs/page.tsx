'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Briefcase, CalendarDays, Download, ExternalLink, Filter, ListTree,
  MapPin, Pencil, Plus, Search, Settings, StickyNote, Trash2, TrendingUp, Trophy,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { resumeStoragePath } from '@/lib/resume-storage'
import { ApplicationStage, JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AddJobDialog from '@/components/AddJobDialog'
import ApplicationLifecycleDialog from '@/components/ApplicationLifecycleDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import AccountSettingsDialog from '@/components/AccountSettingsDialog'
import CompanyAvatar from '@/components/CompanyAvatar'
import Toast from '@/components/Toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const STATUS_OPTIONS: JobApplication['status'][] = [
  'Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted',
]

const STATUS_STYLE: Record<JobApplication['status'], { pill: string; dot: string }> = {
  Bookmarked: { pill: 'bg-slate-700/60 text-slate-300 border border-slate-600/50', dot: 'bg-slate-400' },
  Applied: { pill: 'bg-blue-500/15 text-blue-300 border border-blue-500/30', dot: 'bg-blue-400' },
  Interviewing: { pill: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30', dot: 'bg-yellow-400' },
  Offer: { pill: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', dot: 'bg-emerald-400' },
  Rejected: { pill: 'bg-red-500/15 text-red-300 border border-red-500/30', dot: 'bg-red-400' },
  Ghosted: { pill: 'bg-slate-600/30 text-slate-400 border border-slate-600/30', dot: 'bg-slate-500' },
}

interface ToastState { message: string; type: 'success' | 'error' }
type StageMap = Record<string, ApplicationStage[]>

function stageSummary(stages: ApplicationStage[], status: JobApplication['status']) {
  const rejected = stages.filter((stage) => stage.state === 'rejected').sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime())[0]
  if (status === 'Rejected' && rejected) return { label: rejected.name, detail: 'Rejected', tone: 'text-red-300 border-red-500/30 bg-red-500/10' }
  const current = stages.find((stage) => stage.state === 'current')
  if (current) return { label: current.name, detail: 'Current', tone: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10' }
  const completed = stages.filter((stage) => stage.state === 'completed').sort((a, b) => b.position - a.position)[0]
  if (completed) return { label: completed.name, detail: 'Completed', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' }
  const pending = stages.filter((stage) => stage.state === 'pending').sort((a, b) => a.position - b.position)[0]
  if (pending) return { label: pending.name, detail: 'Next', tone: 'text-blue-300 border-blue-500/30 bg-blue-500/10' }
  return null
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not set'
}

export default function JobsPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [stagesByApplication, setStagesByApplication] = useState<StageMap>({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobApplication['status'] | 'All'>('All')
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [lifecycleDialog, setLifecycleDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [notesDialog, setNotesDialog] = useState({ open: false, notes: '', jobTitle: '', company: '' })

  const showToast = (message: string, type: ToastState['type']) => setToast({ message, type })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.user) {
        if (sessionError) await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? '')
      setUserName(user.user_metadata?.full_name || user.user_metadata?.name || null)
      setAuthChecked(true)
    }
    void checkAuth()
  }, [router])

  const fetchData = useCallback(async (withSpinner = true) => {
    if (!userId) return
    if (withSpinner) setLoading(true)

    const [jobsResult, stagesResult] = await Promise.all([
      supabase.from('job_applications').select('id, job_title, company, job_link, status, date_applied, location, source, resume_url, notes, created_at, user_id').eq('user_id', userId).order('date_applied', { ascending: false }),
      supabase.from('application_stages').select('id, application_id, user_id, name, stage_type, position, state, started_at, completed_at, created_at, updated_at').eq('user_id', userId).order('position', { ascending: true }),
    ])

    if (jobsResult.error) showToast('Failed to load applications. Please refresh.', 'error')
    else setJobs((jobsResult.data ?? []) as JobApplication[])

    if (stagesResult.error) {
      if (stagesResult.error.code !== '42P01' && stagesResult.error.code !== 'PGRST205') showToast('Applications loaded, but lifecycle stages could not be loaded.', 'error')
      setStagesByApplication({})
    } else {
      const grouped = ((stagesResult.data ?? []) as ApplicationStage[]).reduce<StageMap>((result, stage) => {
        if (!result[stage.application_id]) result[stage.application_id] = []
        result[stage.application_id].push(stage)
        return result
      }, {})
      setStagesByApplication(grouped)
    }

    if (withSpinner) setLoading(false)
  }, [userId])

  useEffect(() => { if (authChecked) void fetchData() }, [authChecked, fetchData])

  const handleStatusChange = async (id: string, newStatus: JobApplication['status']) => {
    const applicationStages = stagesByApplication[id] ?? []
    const currentStage = applicationStages.find((stage) => stage.state === 'current')
    const lastCompletedStage = applicationStages.filter((stage) => stage.state === 'completed').sort((a, b) => b.position - a.position)[0]
    const rejectionStage = currentStage ?? lastCompletedStage

    if (newStatus === 'Rejected' && rejectionStage) {
      const { error } = await supabase.from('application_stages').update({ state: 'rejected', completed_at: new Date().toISOString() }).eq('id', rejectionStage.id).eq('user_id', userId)
      if (error) { showToast('Failed to record the rejection stage.', 'error'); return }
      await fetchData(false)
      showToast(`Rejected at ${rejectionStage.name}.`, 'success')
      return
    }

    if (newStatus === 'Offer' && currentStage) {
      const { error } = await supabase.from('application_stages').update({ state: 'completed', completed_at: new Date().toISOString() }).eq('id', currentStage.id).eq('user_id', userId)
      if (error) { showToast('Failed to complete the current stage.', 'error'); return }
    }

    const { error } = await supabase.from('job_applications').update({ status: newStatus }).eq('id', id).eq('user_id', userId)
    if (error) {
      showToast('Failed to update status.', 'error')
      return
    }
    await fetchData(false)
    showToast(`Status changed to ${newStatus}.`, 'success')
  }

  const handleOpenResume = async (resumeValue: string) => {
    const path = resumeStoragePath(resumeValue)
    if (!path) { showToast('Resume file reference is invalid.', 'error'); return }

    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null

    const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, 60)
    if (error || !data?.signedUrl) {
      popup?.close()
      showToast('Failed to open resume.', 'error')
      return
    }

    if (popup) popup.location.href = data.signedUrl
    else showToast('Your browser blocked the resume window. Allow pop-ups and try again.', 'error')
  }

  const handleDeleteConfirm = async () => {
    const job = deleteDialog.job
    if (!job) return
    setDeleteDialog({ open: false, job: null })
    setJobs((current) => current.filter((item) => item.id !== job.id))
    setStagesByApplication((current) => { const next = { ...current }; delete next[job.id]; return next })

    const { error: dbError } = await supabase.from('job_applications').delete().eq('id', job.id).eq('user_id', userId)
    if (dbError) {
      showToast('Failed to delete application.', 'error')
      void fetchData(false)
      return
    }

    if (job.resume_url) {
      const path = resumeStoragePath(job.resume_url)
      if (path) {
        const { error: storageError } = await supabase.storage.from('resumes').remove([path])
        if (storageError) {
          showToast('Application deleted, but its resume file could not be removed.', 'error')
          return
        }
      }
    }

    showToast(`Deleted "${job.job_title}".`, 'success')
  }

  const stats = useMemo(() => ({
    applied: jobs.filter((job) => job.status === 'Applied').length,
    interviewing: jobs.filter((job) => job.status === 'Interviewing').length,
    offer: jobs.filter((job) => job.status === 'Offer').length,
  }), [jobs])

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || job.job_title.toLowerCase().includes(query) || (job.company ?? '').toLowerCase().includes(query) || (job.location ?? '').toLowerCase().includes(query) || (stagesByApplication[job.id] ?? []).some((stage) => stage.name.toLowerCase().includes(query))
    return matchesSearch && (statusFilter === 'All' || job.status === statusFilter)
  }), [jobs, search, stagesByApplication, statusFilter])

  if (!authChecked || loading) {
    return <main className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" /></main>
  }

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:max-w-[1780px] xl:px-10">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button asChild variant="outline" size="icon" className="flex-shrink-0 rounded-full border-slate-700 bg-slate-900">
                <Link href="/" aria-label="Back to home"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold sm:text-4xl">Applications</h1>
                <p className="text-sm text-slate-500">{jobs.length} tracked · {filteredJobs.length} shown</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-600"><Plus className="mr-2 h-4 w-4" />Add application</Button>
              <Button variant="outline" size="icon" className="border-slate-700" onClick={() => setSettingsOpen(true)} aria-label="Account settings"><Settings className="h-4 w-4" /></Button>
              <Button variant="outline" className="border-slate-700" onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) showToast('Could not sign out.', 'error'); else router.replace('/login') }}>Sign out</Button>
            </div>
          </header>

          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ['Applied', stats.applied, Briefcase, 'text-blue-400'],
              ['Interviewing', stats.interviewing, TrendingUp, 'text-yellow-400'],
              ['Offers', stats.offer, Trophy, 'text-emerald-400'],
            ].map(([label, count, Icon, color]) => {
              const StatusIcon = Icon as typeof Briefcase
              return (
                <div key={String(label)} className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 sm:flex sm:items-center sm:gap-3 sm:rounded-2xl sm:px-4">
                  <StatusIcon className={`h-4 w-4 ${String(color)}`} />
                  <div className="mt-2 min-w-0 sm:mt-0"><div className="text-xl font-bold">{String(count)}</div><div className="truncate text-[11px] text-slate-400 sm:text-xs">{String(label)}</div></div>
                </div>
              )
            })}
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="application-search">Search applications</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input id="application-search" value={search} onChange={(event) => setSearch(event.target.value)} className="bg-slate-950 border-slate-700 pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-300"><Filter className="h-4 w-4 text-slate-500" />Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {(['All', ...STATUS_OPTIONS] as const).map((status) => (
                    <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full border px-3 py-1.5 text-xs ${statusFilter === status ? 'border-slate-100 bg-slate-100 text-slate-900' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'}`}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {filteredJobs.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-700 px-5 py-14 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-slate-600" />
              <h2 className="mt-4 text-lg font-semibold">{jobs.length ? 'No matching applications' : 'No applications yet'}</h2>
              <p className="mt-1 text-sm text-slate-500">{jobs.length ? 'Change the search or status filter.' : 'Create your first application to start tracking it.'}</p>
              {!jobs.length && <Button onClick={() => setAddOpen(true)} className="mt-5 bg-emerald-500 text-slate-950 hover:bg-emerald-600"><Plus className="mr-2 h-4 w-4" />Add application</Button>}
            </section>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:hidden">
                {filteredJobs.map((job) => {
                  const summary = stageSummary(stagesByApplication[job.id] ?? [], job.status)
                  return (
                    <article key={job.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <CompanyAvatar company={job.company} fallbackName={job.job_title} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-400">{job.company || 'Company not set'}</p>
                          <h2 className="break-words text-lg font-semibold leading-snug text-slate-100">{job.job_title}</h2>
                        </div>
                        <div className="flex flex-shrink-0 gap-1">
                          <button type="button" onClick={() => setEditDialog({ open: true, job })} aria-label={`Edit ${job.job_title}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setDeleteDialog({ open: true, job })} aria-label={`Delete ${job.job_title}`} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <div className="relative inline-block">
                          <select value={job.status} onChange={(event) => void handleStatusChange(job.id, event.target.value as JobApplication['status'])} aria-label={`Status for ${job.job_title}`} className={`appearance-none rounded-full py-1 pl-5 pr-3 text-xs font-semibold ${STATUS_STYLE[job.status].pill}`}>
                            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <span className={`absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${STATUS_STYLE[job.status].dot}`} />
                        </div>
                        <button type="button" onClick={() => setLifecycleDialog({ open: true, job })} className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-left hover:border-slate-600">
                          <span className="flex min-w-0 items-center gap-2"><ListTree className="h-4 w-4 flex-shrink-0 text-slate-500" />{summary ? <span className={`min-w-0 rounded-full border px-2.5 py-1 ${summary.tone}`}><span className="block truncate text-xs font-semibold">{summary.label}</span><span className="block text-[10px] opacity-70">{summary.detail}</span></span> : <span className="truncate text-xs font-medium text-blue-400">Set interview stages</span>}</span>
                        </button>
                      </div>

                      <dl className="mt-4 grid gap-2 text-sm text-slate-400">
                        <div className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0 text-slate-600" /><dd className="truncate">{job.location || 'Location not set'}</dd></div>
                        <div className="flex min-w-0 items-center gap-2"><CalendarDays className="h-4 w-4 flex-shrink-0 text-slate-600" /><dd>{formatDate(job.date_applied)}</dd></div>
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                        {job.job_link && <a href={job.job_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-slate-800">Job link <ExternalLink className="h-3.5 w-3.5" /></a>}
                        {job.resume_url && <button type="button" onClick={() => void handleOpenResume(job.resume_url!)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"><Download className="h-3.5 w-3.5" />Resume</button>}
                        {job.notes?.trim() && <button type="button" onClick={() => setNotesDialog({ open: true, notes: job.notes ?? '', jobTitle: job.job_title, company: job.company ?? '' })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-slate-800"><StickyNote className="h-3.5 w-3.5" />Notes</button>}
                      </div>
                    </article>
                  )
                })}
              </section>

              <div className="hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 xl:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1280px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[15%]" /><col className="w-[20%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[16%]" />
                      <col className="w-[6%]" /><col className="w-[6%]" /><col className="w-[6%]" /><col className="w-[7%]" /><col className="w-[5%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
                        <th className="px-4 py-3.5">Company</th><th className="px-4 py-3.5">Role</th><th className="px-4 py-3.5">Location</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Stage</th><th className="px-4 py-3.5">Apply</th><th className="px-4 py-3.5">Resume</th><th className="px-4 py-3.5">Notes</th><th className="px-4 py-3.5">Date</th><th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {filteredJobs.map((job) => {
                        const summary = stageSummary(stagesByApplication[job.id] ?? [], job.status)
                        return (
                          <tr key={job.id} className="group hover:bg-slate-800/40">
                            <td className="px-4 py-3.5"><div className="flex min-w-0 items-center gap-3"><CompanyAvatar company={job.company} fallbackName={job.job_title} /><span className="min-w-0 truncate font-medium">{job.company || '—'}</span></div></td>
                            <td className="px-4 py-3.5"><div className="truncate font-semibold">{job.job_title}</div></td>
                            <td className="px-4 py-3.5"><div className="truncate text-slate-400">{job.location || '—'}</div></td>
                            <td className="px-4 py-3.5"><div className="relative inline-block"><select value={job.status} onChange={(event) => void handleStatusChange(job.id, event.target.value as JobApplication['status'])} aria-label={`Status for ${job.job_title}`} className={`appearance-none rounded-full py-1 pl-5 pr-3 text-xs font-semibold ${STATUS_STYLE[job.status].pill}`}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select><span className={`absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${STATUS_STYLE[job.status].dot}`} /></div></td>
                            <td className="px-4 py-3.5"><button type="button" onClick={() => setLifecycleDialog({ open: true, job })} className="flex min-w-0 max-w-full items-center gap-2 text-left"><ListTree className="h-4 w-4 flex-shrink-0 text-slate-500" />{summary ? <span className={`min-w-0 rounded-full border px-2.5 py-1 ${summary.tone}`}><span className="block truncate text-xs font-semibold">{summary.label}</span><span className="block text-[10px] opacity-70">{summary.detail}</span></span> : <span className="text-xs text-blue-400">Add stages</span>}</button></td>
                            <td className="px-4 py-3.5">{job.job_link ? <a href={job.job_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400">Link<ExternalLink className="h-3 w-3" /></a> : '—'}</td>
                            <td className="px-4 py-3.5">{job.resume_url ? <button type="button" onClick={() => void handleOpenResume(job.resume_url!)} className="inline-flex items-center gap-1"><Download className="h-3 w-3" />CV</button> : '—'}</td>
                            <td className="px-4 py-3.5">{job.notes?.trim() ? <button type="button" onClick={() => setNotesDialog({ open: true, notes: job.notes ?? '', jobTitle: job.job_title, company: job.company ?? '' })} className="inline-flex items-center gap-1 text-amber-400"><StickyNote className="h-3 w-3" />View</button> : '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{job.date_applied ? new Date(job.date_applied).toLocaleDateString('en-IE', { day: '2-digit', month: 'short' }) : '—'}</td>
                            <td className="px-2 py-3.5"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><button type="button" onClick={() => setEditDialog({ open: true, job })} aria-label={`Edit ${job.job_title}`} className="p-1.5"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setDeleteDialog({ open: true, job })} aria-label={`Delete ${job.job_title}`} className="p-1.5 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <AddJobDialog open={addOpen} setOpen={setAddOpen} userId={userId} onError={(message) => showToast(message, 'error')} onSuccess={(job) => { setJobs((current) => [job, ...current]); showToast('Application added.', 'success') }} />
      {editDialog.job && <AddJobDialog open={editDialog.open} setOpen={(open) => setEditDialog({ open, job: editDialog.job })} userId={userId} editJob={editDialog.job} onError={(message) => showToast(message, 'error')} onSuccess={(job) => { setJobs((current) => current.map((item) => item.id === job.id ? job : item)); setEditDialog({ open: false, job: null }); showToast('Application updated.', 'success') }} />}
      {lifecycleDialog.job && <ApplicationLifecycleDialog open={lifecycleDialog.open} setOpen={(open) => setLifecycleDialog((current) => ({ ...current, open }))} job={jobs.find((item) => item.id === lifecycleDialog.job?.id) ?? lifecycleDialog.job} userId={userId} onChanged={() => fetchData(false)} onError={(message) => showToast(message, 'error')} onSuccess={(message) => showToast(message, 'success')} />}
      <DeleteConfirmDialog open={deleteDialog.open} jobTitle={deleteDialog.job?.job_title ?? ''} company={deleteDialog.job?.company ?? ''} onConfirm={() => void handleDeleteConfirm()} onCancel={() => setDeleteDialog({ open: false, job: null })} />
      <AccountSettingsDialog open={settingsOpen} setOpen={setSettingsOpen} jobs={jobs} userId={userId} userEmail={userEmail} userName={userName} onDataDeleted={() => { setJobs([]); setStagesByApplication({}); showToast('All data deleted.', 'success') }} />
      <Dialog open={notesDialog.open} onOpenChange={(open) => setNotesDialog((current) => ({ ...current, open }))}><DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100"><DialogHeader><DialogTitle className="break-words">{notesDialog.jobTitle}{notesDialog.company && ` — ${notesDialog.company}`}</DialogTitle></DialogHeader><p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-300">{notesDialog.notes}</p></DialogContent></Dialog>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  )
}
