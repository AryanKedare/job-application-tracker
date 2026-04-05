// app/jobs/page.tsx
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Download, ExternalLink, Plus, Pencil, Trash2,
  StickyNote, Search, Filter, Briefcase, TrendingUp, Trophy,
  Settings,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AddJobDialog from '@/components/AddJobDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import AccountSettingsDialog from '@/components/AccountSettingsDialog'
import Toast from '@/components/Toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STATUS_OPTIONS: JobApplication['status'][] = [
  'Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted',
]

const STATUS_STYLE: Record<JobApplication['status'], { pill: string; dot: string }> = {
  Bookmarked:   { pill: 'bg-slate-700/60 text-slate-300 border border-slate-600/50',        dot: 'bg-slate-400' },
  Applied:      { pill: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',           dot: 'bg-blue-400' },
  Interviewing: { pill: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',     dot: 'bg-yellow-400' },
  Offer:        { pill: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',  dot: 'bg-emerald-400' },
  Rejected:     { pill: 'bg-red-500/15 text-red-300 border border-red-500/30',              dot: 'bg-red-400' },
  Ghosted:      { pill: 'bg-slate-600/30 text-slate-400 border border-slate-600/30',        dot: 'bg-slate-500' },
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const colors = ['bg-blue-600','bg-violet-600','bg-emerald-600','bg-amber-600','bg-rose-600','bg-cyan-600']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  )
}

interface ToastState { message: string; type: 'success' | 'error' }

export default function JobsTablePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId]     = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName]   = useState<string | null>(null)
  const [jobs, setJobs]           = useState<JobApplication[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState<ToastState | null>(null)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<JobApplication['status'] | 'All'>('All')

  const [addOpen,      setAddOpen]      = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editDialog,   setEditDialog]   = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [notesDialog,  setNotesDialog]  = useState<{ open: boolean; notes: string; jobTitle: string; company: string }>({
    open: false, notes: '', jobTitle: '', company: '',
  })

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login') }
      else {
        setUserId(user.id)
        setUserEmail(user.email ?? '')
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || null)
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [router])

  const fetchJobs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, job_title, company, job_link, status, date_applied, location, source, resume_url, notes, created_at, user_id')
        .eq('user_id', userId)
        .order('date_applied', { ascending: false })
      if (error) throw error
      setJobs(data || [])
    } catch {
      showToast('Failed to load applications. Please refresh.', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { if (authChecked) fetchJobs() }, [authChecked, fetchJobs])

  const handleStatusChange = async (id: string, newStatus: JobApplication['status']) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j)))
    const { error } = await supabase.from('job_applications').update({ status: newStatus }).eq('id', id).eq('user_id', userId)
    if (error) { showToast('Failed to update status.', 'error'); fetchJobs() }
  }

  const handleDeleteConfirm = async () => {
    const job = deleteDialog.job
    if (!job) return
    setDeleteDialog({ open: false, job: null })
    setJobs((prev) => prev.filter((j) => j.id !== job.id))
    const { error } = await supabase.from('job_applications').delete().eq('id', job.id).eq('user_id', userId)
    if (error) { showToast('Failed to delete.', 'error'); fetchJobs() }
    else showToast(`Deleted "${job.job_title}".`, 'success')
  }

  const handleAddSuccess    = (j: JobApplication) => { setJobs((p) => [j, ...p]); showToast('Application added!', 'success') }
  const handleEditSuccess   = (j: JobApplication) => { setJobs((p) => p.map((x) => (x.id === j.id ? j : x))); showToast('Updated!', 'success'); setEditDialog({ open: false, job: null }) }
  const handleSignOut       = async () => { await supabase.auth.signOut(); router.replace('/login') }
  const handleDataDeleted   = () => { setJobs([]); showToast('All data deleted.', 'success') }

  const statsCount = useMemo(() => ({
    applied:      jobs.filter((j) => j.status === 'Applied').length,
    interviewing: jobs.filter((j) => j.status === 'Interviewing').length,
    offer:        jobs.filter((j) => j.status === 'Offer').length,
  }), [jobs])

  const filteredJobs = useMemo(() => jobs.filter((j) => {
    const q = search.toLowerCase()
    const matchSearch = q === '' || j.job_title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || (j.location ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All' || j.status === statusFilter
    return matchSearch && matchStatus
  }), [jobs, search, statusFilter])

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading applications…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6">

          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="outline" size="icon" className="rounded-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Applications</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {jobs.length} tracked &bull; {filteredJobs.length} shown
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl px-5 h-10">
                <Plus className="w-4 h-4 mr-2" /> Add application
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-100 h-10 w-10"
                onClick={() => setSettingsOpen(true)}
                title="Account settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 h-10" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-blue-300 leading-none">{statsCount.applied}</div>
                <div className="text-xs text-slate-400 mt-0.5">Applied</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-300 leading-none">{statsCount.interviewing}</div>
                <div className="text-xs text-slate-400 mt-0.5">Interviewing</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-300 leading-none">{statsCount.offer}</div>
                <div className="text-xs text-slate-400 mt-0.5">Offers</div>
              </div>
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by role, company, or location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 h-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="w-4 h-4 text-slate-500" />
              <div className="flex gap-1.5 flex-wrap">
                {(['All', ...STATUS_OPTIONS] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s as JobApplication['status'] | 'All')}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-slate-100 text-slate-900 border-slate-100'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Empty states */}
          {jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-24 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40">
              <StickyNote className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No applications yet</h3>
              <p className="text-slate-500 text-sm max-w-xs mb-6">Start tracking your job search — add your first application.</p>
              <Button onClick={() => setAddOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Add first application
              </Button>
            </div>
          )}
          {jobs.length > 0 && filteredJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40">
              <Search className="w-10 h-10 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-300 mb-1">No results found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search or filter.</p>
            </div>
          )}

          {/* Table */}
          {filteredJobs.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3.5">Company</th>
                      <th className="px-5 py-3.5">Role</th>
                      <th className="px-5 py-3.5">Location</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Apply</th>
                      <th className="px-5 py-3.5">Resume</th>
                      <th className="px-5 py-3.5">Notes</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredJobs.map((job) => (
                      <tr key={job.id} className="group hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5 min-w-[140px]">
                            <CompanyAvatar name={job.company || job.job_title} />
                            <span className="font-medium text-slate-100 truncate max-w-[130px]">{job.company || '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-[240px]">
                          <span className="font-semibold text-slate-50 truncate block">{job.job_title}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-400 whitespace-nowrap text-xs">{job.location || '—'}</td>
                        <td className="px-5 py-4">
                          <div className="relative inline-block">
                            <select
                              value={job.status}
                              onChange={(e) => handleStatusChange(job.id, e.target.value as JobApplication['status'])}
                              className={`appearance-none cursor-pointer text-xs font-semibold rounded-full pl-5 pr-3 py-1 outline-none transition-colors ${STATUS_STYLE[job.status].pill}`}
                              aria-label={`Status for ${job.job_title}`}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s} className="bg-slate-900 text-slate-100">{s}</option>
                              ))}
                            </select>
                            <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${STATUS_STYLE[job.status].dot}`} />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {job.job_link ? (
                            <a href={job.job_link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                              Link <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-xs text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          {job.resume_url ? (
                            <a href={job.resume_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-2.5 py-1 transition-colors">
                              <Download className="w-3 h-3" /> CV
                            </a>
                          ) : <span className="text-xs text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          {job.notes?.trim() ? (
                            <button
                              onClick={() => setNotesDialog({ open: true, notes: job.notes!, jobTitle: job.job_title, company: job.company })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-1 transition-colors">
                              <StickyNote className="w-3 h-3" /> View
                            </button>
                          ) : <span className="text-xs text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-xs">
                          {job.date_applied ? new Date(job.date_applied).toLocaleDateString('en-IE', { day: '2-digit', month: 'short' }) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditDialog({ open: true, job })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-100 hover:bg-slate-700 transition-colors"
                              aria-label={`Edit ${job.job_title}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteDialog({ open: true, job })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              aria-label={`Delete ${job.job_title}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddJobDialog open={addOpen} setOpen={setAddOpen} onSuccess={handleAddSuccess} onError={(msg) => showToast(msg, 'error')} userId={userId} />
      {editDialog.job && (
        <AddJobDialog open={editDialog.open} setOpen={(v) => setEditDialog({ open: v, job: editDialog.job })} onSuccess={handleEditSuccess} onError={(msg) => showToast(msg, 'error')} userId={userId} editJob={editDialog.job} />
      )}
      <DeleteConfirmDialog open={deleteDialog.open} jobTitle={deleteDialog.job?.job_title ?? ''} company={deleteDialog.job?.company ?? ''} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteDialog({ open: false, job: null })} />

      <AccountSettingsDialog
        open={settingsOpen}
        setOpen={setSettingsOpen}
        jobs={jobs}
        userId={userId}
        userEmail={userEmail}
        userName={userName}
        onDataDeleted={handleDataDeleted}
      />

      <Dialog open={notesDialog.open} onOpenChange={(v) => setNotesDialog((p) => ({ ...p, open: v }))}>
        <DialogContent className="max-w-lg flex flex-col max-h-[70vh] bg-slate-900 border border-slate-700 text-slate-100 p-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-800">
            <DialogTitle className="text-base font-bold leading-snug">
              {notesDialog.jobTitle}
              {notesDialog.company && <span className="text-slate-400 font-normal"> — {notesDialog.company}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{notesDialog.notes || 'No notes.'}</p>
          </div>
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-800">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setNotesDialog((p) => ({ ...p, open: false }))}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  )
}
