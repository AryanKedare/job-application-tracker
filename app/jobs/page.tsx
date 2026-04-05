// app/jobs/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, Plus, Pencil, Trash2, StickyNote } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import AddJobDialog from '@/components/AddJobDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import Toast from '@/components/Toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const STATUS_OPTIONS: JobApplication['status'][] = [
  'Bookmarked',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
  'Ghosted',
]

const STATUS_COLORS: Record<JobApplication['status'], string> = {
  Bookmarked:   'bg-slate-700 text-slate-200',
  Applied:      'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  Interviewing: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  Offer:        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  Rejected:     'bg-red-500/20 text-red-300 border border-red-500/40',
  Ghosted:      'bg-slate-600/40 text-slate-400',
}

interface ToastState {
  message: string
  type: 'success' | 'error'
}

export default function JobsTablePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: JobApplication | null }>({ open: false, job: null })
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; notes: string; jobTitle: string; company: string }>({
    open: false, notes: '', jobTitle: '', company: '',
  })

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
      } else {
        setUserId(user.id)
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [router])

  // ── Data fetching ─────────────────────────────────────────────────────────
  // FIX: wrapped in useCallback so it can safely appear in dependency arrays
  const fetchJobs = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, job_title, company, job_link, status, date_applied, location, source, resume_url, notes, created_at, user_id')
        // FIX: defence-in-depth — always filter by the authenticated user's id
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

  useEffect(() => {
    if (authChecked) fetchJobs()
  }, [authChecked, fetchJobs])

  // ── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (id: string, newStatus: JobApplication['status']) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j)))

    const { error } = await supabase
      .from('job_applications')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      showToast('Failed to update status.', 'error')
      fetchJobs()
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    const job = deleteDialog.job
    if (!job) return
    setDeleteDialog({ open: false, job: null })

    setJobs((prev) => prev.filter((j) => j.id !== job.id))

    const { error } = await supabase
      .from('job_applications')
      .delete()
      .eq('id', job.id)
      .eq('user_id', userId)

    if (error) {
      showToast('Failed to delete application.', 'error')
      fetchJobs()
    } else {
      showToast(`Deleted "${job.job_title}".`, 'success')
    }
  }

  // ── Add / Edit callbacks ──────────────────────────────────────────────────
  const handleAddSuccess = (newJob: JobApplication) => {
    setJobs((prev) => [newJob, ...prev])
    showToast('Application added!', 'success')
  }

  const handleEditSuccess = (updatedJob: JobApplication) => {
    setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)))
    showToast('Application updated!', 'success')
    setEditDialog({ open: false, job: null })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Link href="/">
                  <Button variant="outline" size="icon" className="rounded-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Applications</h1>
              </div>
              <p className="text-sm text-slate-400">
                Total: <span className="font-semibold text-slate-100">{jobs.length}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl px-6 h-11"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add application
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>
          </div>

          {/* Empty state */}
          {jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-24 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40">
              <StickyNote className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No applications yet</h3>
              <p className="text-slate-500 text-sm max-w-xs mb-6">
                Start tracking your job search — add your first application.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add first application
              </Button>
            </div>
          )}

          {/* Table */}
          {jobs.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/90 border-b border-slate-800">
                    <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Apply</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Resume</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-900/60">
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="font-medium text-slate-100 truncate">{job.company || '—'}</div>
                        </td>
                        <td className="px-4 py-3 max-w-[260px]">
                          <div className="font-semibold text-slate-50 truncate">{job.job_title}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{job.location || '—'}</td>
                        <td className="px-4 py-3">
                          {job.job_link ? (
                            <a
                              href={job.job_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/40 hover:bg-blue-500/25"
                            >
                              Apply <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">No link</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={job.status}
                            onChange={(e) => handleStatusChange(job.id, e.target.value as JobApplication['status'])}
                            className={`text-xs rounded-full px-2.5 py-1 cursor-pointer outline-none ${STATUS_COLORS[job.status]}`}
                            aria-label={`Status for ${job.job_title}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s} className="bg-slate-900 text-slate-100">{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {job.resume_url ? (
                            <a
                              href={job.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 border border-slate-700 hover:bg-slate-700"
                            >
                              <Download className="w-3 h-3 mr-1" /> Resume
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">Not uploaded</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {job.notes?.trim() ? (
                            <button
                              onClick={() => setNotesDialog({ open: true, notes: job.notes!, jobTitle: job.job_title, company: job.company })}
                              className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/40 hover:bg-amber-500/25"
                            >
                              <StickyNote className="w-3 h-3 mr-1" /> View
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">No notes</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                          {job.date_applied
                            ? new Date(job.date_applied).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditDialog({ open: true, job })}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                              aria-label={`Edit ${job.job_title}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteDialog({ open: true, job })}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              aria-label={`Delete ${job.job_title}`}
                            >
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

      {/* Add dialog */}
      <AddJobDialog
        open={addOpen}
        setOpen={setAddOpen}
        onSuccess={handleAddSuccess}
        onError={(msg) => showToast(msg, 'error')}
        userId={userId}
      />

      {/* Edit dialog */}
      {editDialog.job && (
        <AddJobDialog
          open={editDialog.open}
          setOpen={(v) => setEditDialog({ open: v, job: editDialog.job })}
          onSuccess={handleEditSuccess}
          onError={(msg) => showToast(msg, 'error')}
          userId={userId}
          editJob={editDialog.job}
        />
      )}

      {/* Delete confirm dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        jobTitle={deleteDialog.job?.job_title ?? ''}
        company={deleteDialog.job?.company ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ open: false, job: null })}
      />

      {/* Notes dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(v) => setNotesDialog((p) => ({ ...p, open: v }))}>
        <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {notesDialog.jobTitle}{notesDialog.company ? ` — ${notesDialog.company}` : ''}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {notesDialog.notes || 'No notes.'}
          </p>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  )
}
