'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Briefcase, Download, ExternalLink, Filter, Pencil, Plus,
  Search, Settings, StickyNote, Trash2, TrendingUp, Trophy,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AddJobDialog from '@/components/AddJobDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import AccountSettingsDialog from '@/components/AccountSettingsDialog'
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

function AvatarShell({ children, colorClass = 'bg-white' }: { children: React.ReactNode; colorClass?: string }) {
  return (
    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.35)] ring-1 ring-white/10 ${colorClass}`}>
      {children}
    </div>
  )
}

function InitialsAvatar({ name }: { name: string }) {
  const safeName = name.trim() || '?'
  const initials = safeName.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('')
  const palettes = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-500', 'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600']
  const color = palettes[safeName.charCodeAt(0) % palettes.length]
  return <AvatarShell colorClass={color}><span className="text-xs font-bold tracking-wide text-white">{initials}</span></AvatarShell>
}

function CompanyAvatar({ name }: { name: string }) {
  const [failed, setFailed] = useState(false)
  const company = name.trim()

  useEffect(() => setFailed(false), [company])

  if (!company || failed) return <InitialsAvatar name={company || '?'} />

  return (
    <AvatarShell>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/company-logo?company=${encodeURIComponent(company)}`}
        alt={`${company} logo`}
        width={32}
        height={32}
        className="w-8 h-8 object-contain p-0.5"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </AvatarShell>
  )
}

interface ToastState { message: string; type: 'success' | 'error' }

function extractStoragePath(resumeUrl: string): string | null {
  const match = resumeUrl.match(/\/object\/public\/resumes\/(.+)$/)
  return match ? match[1] : null
}

export default function JobsTablePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobApplication['status'] | 'All'>('All')
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [notesDialog, setNotesDialog] = useState({ open: false, notes: '', jobTitle: '', company: '' })

  const showToast = (message: string, type: ToastState['type']) => setToast({ message, type })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
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

  const fetchJobs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('job_applications')
      .select('id, job_title, company, job_link, status, date_applied, location, source, resume_url, notes, created_at, user_id')
      .eq('user_id', userId)
      .order('date_applied', { ascending: false })
    if (error) showToast('Failed to load applications. Please refresh.', 'error')
    else setJobs((data ?? []) as JobApplication[])
    setLoading(false)
  }, [userId])

  useEffect(() => { if (authChecked) void fetchJobs() }, [authChecked, fetchJobs])

  const handleStatusChange = async (id: string, newStatus: JobApplication['status']) => {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, status: newStatus } : job))
    const { error } = await supabase.from('job_applications').update({ status: newStatus }).eq('id', id).eq('user_id', userId)
    if (error) {
      showToast('Failed to update status.', 'error')
      void fetchJobs()
    }
  }

  const handleDeleteConfirm = async () => {
    const job = deleteDialog.job
    if (!job) return
    setDeleteDialog({ open: false, job: null })
    setJobs((current) => current.filter((item) => item.id !== job.id))

    const { error: dbError } = await supabase.from('job_applications').delete().eq('id', job.id).eq('user_id', userId)
    if (dbError) {
      showToast('Failed to delete application.', 'error')
      void fetchJobs()
      return
    }

    if (job.resume_url) {
      const path = extractStoragePath(job.resume_url)
      if (path) await supabase.storage.from('resumes').remove([path])
    }
    showToast(`Deleted "${job.job_title}".`, 'success')
  }

  const stats = useMemo(() => ({
    applied: jobs.filter((job) => job.status === 'Applied').length,
    interviewing: jobs.filter((job) => job.status === 'Interviewing').length,
    offer: jobs.filter((job) => job.status === 'Offer').length,
  }), [jobs])

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const query = search.toLowerCase()
    const matchesSearch = !query || job.job_title.toLowerCase().includes(query) || (job.company ?? '').toLowerCase().includes(query) || (job.location ?? '').toLowerCase().includes(query)
    return matchesSearch && (statusFilter === 'All' || job.status === statusFilter)
  }), [jobs, search, statusFilter])

  if (!authChecked || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950"><div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/"><Button variant="outline" size="icon" className="rounded-full border-slate-700 bg-slate-900"><ArrowLeft className="w-4 h-4" /></Button></Link>
              <div><h1 className="text-3xl md:text-4xl font-bold">Applications</h1><p className="text-sm text-slate-500">{jobs.length} tracked &bull; {filteredJobs.length} shown</p></div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"><Plus className="w-4 h-4 mr-2" />Add application</Button>
              <Button variant="outline" size="icon" className="border-slate-700" onClick={() => setSettingsOpen(true)}><Settings className="w-4 h-4" /></Button>
              <Button variant="outline" className="border-slate-700" onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>Sign out</Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              ['Applied', stats.applied, Briefcase, 'blue'],
              ['Interviewing', stats.interviewing, TrendingUp, 'yellow'],
              ['Offers', stats.offer, Trophy, 'emerald'],
            ].map(([label, count, Icon, color]) => {
              const StatusIcon = Icon as typeof Briefcase
              return <div key={String(label)} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3"><StatusIcon className={`w-4 h-4 text-${color}-400`} /><div><div className="text-xl font-bold">{String(count)}</div><div className="text-xs text-slate-400">{String(label)}</div></div></div>
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by role, company, or location…" className="pl-9 bg-slate-900 border-slate-700" /></div>
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-slate-500" /><div className="flex gap-1.5 flex-wrap">{(['All', ...STATUS_OPTIONS] as const).map((status) => <button key={status} onClick={() => setStatusFilter(status)} className={`text-xs px-3 py-1.5 rounded-full border ${statusFilter === status ? 'bg-slate-100 text-slate-900 border-slate-100' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{status}</button>)}</div></div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-slate-700 text-slate-400">{jobs.length ? 'No results found.' : 'No applications yet.'}</div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase"><th className="px-5 py-3.5">Company</th><th className="px-5 py-3.5">Role</th><th className="px-5 py-3.5">Location</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Apply</th><th className="px-5 py-3.5">Resume</th><th className="px-5 py-3.5">Notes</th><th className="px-5 py-3.5">Date</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-800/70">{filteredJobs.map((job) => <tr key={job.id} className="group hover:bg-slate-800/40">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3 min-w-[150px]"><CompanyAvatar name={job.company || job.job_title} /><span className="font-medium truncate max-w-[140px]">{job.company || '—'}</span></div></td>
                <td className="px-5 py-3.5 font-semibold max-w-[240px]">{job.job_title}</td>
                <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">{job.location || '—'}</td>
                <td className="px-5 py-3.5"><div className="relative inline-block"><select value={job.status} onChange={(event) => void handleStatusChange(job.id, event.target.value as JobApplication['status'])} className={`appearance-none text-xs font-semibold rounded-full pl-5 pr-3 py-1 ${STATUS_STYLE[job.status].pill}`}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select><span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${STATUS_STYLE[job.status].dot}`} /></div></td>
                <td className="px-5 py-3.5">{job.job_link ? <a href={job.job_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400">Link<ExternalLink className="w-3 h-3" /></a> : '—'}</td>
                <td className="px-5 py-3.5">{job.resume_url ? <a href={job.resume_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1"><Download className="w-3 h-3" />CV</a> : '—'}</td>
                <td className="px-5 py-3.5">{job.notes?.trim() ? <button onClick={() => setNotesDialog({ open: true, notes: job.notes ?? '', jobTitle: job.job_title, company: job.company ?? '' })} className="inline-flex items-center gap-1 text-amber-400"><StickyNote className="w-3 h-3" />View</button> : '—'}</td>
                <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{job.date_applied ? new Date(job.date_applied).toLocaleDateString('en-IE', { day: '2-digit', month: 'short' }) : '—'}</td>
                <td className="px-5 py-3.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => setEditDialog({ open: true, job })} className="p-1.5"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => setDeleteDialog({ open: true, job })} className="p-1.5 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
              </tr>)}</tbody>
            </table></div></div>
          )}
        </div>
      </div>

      <AddJobDialog open={addOpen} setOpen={setAddOpen} userId={userId} onError={(message) => showToast(message, 'error')} onSuccess={(job) => { setJobs((current) => [job, ...current]); showToast('Application added!', 'success') }} />
      {editDialog.job && <AddJobDialog open={editDialog.open} setOpen={(open) => setEditDialog({ open, job: editDialog.job })} userId={userId} editJob={editDialog.job} onError={(message) => showToast(message, 'error')} onSuccess={(job) => { setJobs((current) => current.map((item) => item.id === job.id ? job : item)); setEditDialog({ open: false, job: null }); showToast('Updated!', 'success') }} />}
      <DeleteConfirmDialog open={deleteDialog.open} jobTitle={deleteDialog.job?.job_title ?? ''} company={deleteDialog.job?.company ?? ''} onConfirm={() => void handleDeleteConfirm()} onCancel={() => setDeleteDialog({ open: false, job: null })} />
      <AccountSettingsDialog open={settingsOpen} setOpen={setSettingsOpen} jobs={jobs} userId={userId} userEmail={userEmail} userName={userName} onDataDeleted={() => { setJobs([]); showToast('All data deleted.', 'success') }} />

      <Dialog open={notesDialog.open} onOpenChange={(open) => setNotesDialog((current) => ({ ...current, open }))}><DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100"><DialogHeader><DialogTitle>{notesDialog.jobTitle}{notesDialog.company && ` — ${notesDialog.company}`}</DialogTitle></DialogHeader><p className="text-sm text-slate-300 whitespace-pre-wrap">{notesDialog.notes}</p></DialogContent></Dialog>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  )
}
