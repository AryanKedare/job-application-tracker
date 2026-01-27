'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, Plus } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import AddJobDialog from '@/components/AddJobDialog'
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

export default function JobsTablePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const [notesDialog, setNotesDialog] = useState<{
    open: boolean
    notes: string
    jobTitle: string
    company: string
  }>({
    open: false,
    notes: '',
    jobTitle: '',
    company: '',
  })

  const [editDialog, setEditDialog] = useState<{
    open: boolean
    job: JobApplication | null
  }>({
    open: false,
    job: null,
  })

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
      } else {
        setAuthChecked(true)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (!authChecked) return
    fetchJobs()
  }, [authChecked])

  const fetchJobs = async () => {
    try {
      const { data } = await supabase
        .from('job_applications')
        .select(`
          id,
          job_title,
          company,
          job_link,
          status,
          date_applied,
          location,
          source,
          resume_url,
          notes,
          created_at,
          user_id
        `)
        .order('date_applied', { ascending: false })

      setJobs(data || [])
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (
    id: string,
    newStatus: JobApplication['status'],
  ) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, status: newStatus } : job)),
    )

    const { error } = await supabase
      .from('job_applications')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      console.error('Failed to update status:', error)
      fetchJobs()
    }
  }

  const handleDelete = async (id: string) => {
    const ok = confirm('Delete this application?')
    if (!ok) return

    setJobs((prev) => prev.filter((job) => job.id !== id))

    const { error } = await supabase
      .from('job_applications')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete job:', error)
      fetchJobs()
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const openNotesDialogForJob = (job: JobApplication) => {
    setNotesDialog({
      open: true,
      notes: job.notes || '',
      jobTitle: job.job_title,
      company: job.company,
    })
  }

  const openEditDialogForJob = (job: JobApplication) => {
    setEditDialog({
      open: true,
      job,
    })
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
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Applications
                </h1>
              </div>
              <p className="text-sm text-slate-400">
                Total applications:{' '}
                <span className="font-semibold text-slate-100">
                  {jobs.length}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setOpen(true)}
                className="self-start bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl px-6 h-11"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add application
              </Button>
              <Button
                variant="outline"
                className="self-start border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>
          </div>

          {/* Table */}
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
                    <th className="px-4 py-3">Edit</th>
                    <th className="px-4 py-3">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-medium text-slate-100 truncate">
                          {job.company || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="font-semibold text-slate-50 truncate">
                          {job.job_title}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {job.location || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {job.job_link ? (
                          <a
                            href={job.job_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/40 hover:bg-blue-500/25"
                          >
                            Apply
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">No link</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={job.status}
                          onChange={(e) =>
                            handleStatusChange(
                              job.id,
                              e.target.value as JobApplication['status'],
                            )
                          }
                          className="bg-slate-900 border border-slate-700 text-xs rounded-full px-2.5 py-1 text-slate-100 max-w-[130px]"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
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
                            <Download className="w-3 h-3 mr-1" />
                            Resume
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Not uploaded
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {job.notes && job.notes.trim().length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => openNotesDialogForJob(job)}
                          >
                            View notes
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">No notes</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {job.date_applied
                          ? new Date(job.date_applied).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 text-slate-200 hover:bg-slate-800"
                          onClick={() => openEditDialogForJob(job)}
                        >
                          Edit
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-500/60 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDelete(job.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {jobs.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-16 text-center text-slate-500"
                      >
                        No applications yet. Click "Add application" to create
                        your first entry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AddJobDialog
          open={open}
          setOpen={setOpen}
          onSuccess={() => {
            setLoading(true)
            fetchJobs()
          }}
        />
      </div>

      {/* Notes dialog */}
      <Dialog
        open={notesDialog.open}
        onOpenChange={(open) =>
          setNotesDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Notes for {notesDialog.jobTitle}
              {notesDialog.company ? ` @ ${notesDialog.company}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3 text-sm">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {notesDialog.notes || 'No notes added yet.'}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editDialog.job && (
        <Dialog
          open={editDialog.open}
          onOpenChange={(open) =>
            setEditDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit application</DialogTitle>
            </DialogHeader>
            <EditJobForm
              job={editDialog.job}
              onClose={() => setEditDialog({ open: false, job: null })}
              onSaved={() => {
                setEditDialog({ open: false, job: null })
                setLoading(true)
                fetchJobs()
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

/* Edit form component with resume change support */

type EditJobFormProps = {
  job: JobApplication
  onClose: () => void
  onSaved: () => void
}

function EditJobForm({ job, onClose, onSaved }: EditJobFormProps) {
  const [form, setForm] = useState({
    job_title: job.job_title,
    company: job.company,
    job_link: job.job_link ?? '',
    status: job.status,
    location: job.location ?? '',
    source: job.source ?? '',
    notes: job.notes ?? '',
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleChange =
    (field: keyof typeof form) =>
    (
      e:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>
        | React.ChangeEvent<HTMLSelectElement>,
    ) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      let resumeUrl = job.resume_url ?? null

      if (resumeFile) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          alert('You need to be logged in to update applications.')
          return
        }

        const ext = resumeFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, resumeFile)

        if (uploadError) {
          console.error(uploadError)
          alert('Failed to upload new resume.')
          return
        }

        const { data: urlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(fileName)

        resumeUrl = urlData.publicUrl
      }

      const { error } = await supabase
        .from('job_applications')
        .update({
          job_title: form.job_title,
          company: form.company,
          job_link: form.job_link || null,
          status: form.status,
          location: form.location || null,
          source: form.source || null,
          notes: form.notes || null,
          resume_url: resumeUrl,
        })
        .eq('id', job.id)

      if (error) {
        console.error('Failed to update job:', error)
        alert('Failed to update job.')
        return
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-300"
            htmlFor="edit-job-title"
          >
            Job Title
          </label>
          <input
            id="edit-job-title"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={form.job_title}
            onChange={handleChange('job_title')}
            required
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-300"
            htmlFor="edit-company"
          >
            Company
          </label>
          <input
            id="edit-company"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={form.company}
            onChange={handleChange('company')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-300"
            htmlFor="edit-job-link"
          >
            Job Link
          </label>
          <input
            id="edit-job-link"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={form.job_link}
            onChange={handleChange('job_link')}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-300"
            htmlFor="edit-status"
          >
            Status
          </label>
          <select
            id="edit-status"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={form.status}
            onChange={handleChange('status')}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-300"
            htmlFor="edit-location"
          >
            Location
          </label>
          <input
            id="edit-location"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={form.location}
            onChange={handleChange('location')}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-300"
            htmlFor="edit-source"
          >
            Source
          </label>
          <input
            id="edit-source"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={form.source}
            onChange={handleChange('source')}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300">
          Resume (PDF/DOC/DOCX)
        </label>
        <div className="flex items-center gap-3">
          <input
            id="edit-resume"
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="edit-resume"
            className="inline-flex cursor-pointer items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 hover:bg-slate-800"
          >
            Choose file
          </label>
          <span className="text-xs text-slate-400">
            {resumeFile?.name ||
              (job.resume_url ? 'Current resume uploaded' : 'No resume')}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <label
          className="text-xs font-medium text-slate-300"
          htmlFor="edit-notes"
        >
          Notes
        </label>
        <textarea
          id="edit-notes"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 min-h-[100px]"
          value={form.notes}
          onChange={handleChange('notes')}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 text-slate-300"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

