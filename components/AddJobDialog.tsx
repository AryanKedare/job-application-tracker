'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { resumeStoragePath } from '@/lib/resume-storage'
import { JobApplication } from '@/lib/types'
import { Paperclip, Sparkles, X } from 'lucide-react'

interface Props {
  open: boolean
  setOpen: (open: boolean) => void
  onSuccess: (job: JobApplication) => void
  onError: (message: string) => void
  userId: string
  editJob?: JobApplication | null
}

const EMPTY_FORM = {
  job_title: '', company: '', job_link: '',
  status: 'Applied' as JobApplication['status'],
  location: '', source: '', notes: '',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024

function formFromJob(job?: JobApplication | null) {
  return job ? {
    job_title: job.job_title,
    company: job.company ?? '',
    job_link: job.job_link ?? '',
    status: job.status,
    location: job.location ?? '',
    source: job.source ?? '',
    notes: job.notes ?? '',
  } : { ...EMPTY_FORM }
}

function isSafeUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch { return false }
}

export default function AddJobDialog({ open, setOpen, onSuccess, onError, userId, editJob }: Props) {
  const [formData, setFormData] = useState(formFromJob(editJob))
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFormData(formFromJob(editJob))
      setResumeFile(null)
      setUrlError(null)
    }
  }, [open, editJob?.id])

  const field = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((previous) => ({ ...previous, [key]: value }))

  const handleLink = (value: string) => {
    field('job_link', value)
    setUrlError(value && !isSafeUrl(value) ? 'Enter a valid http:// or https:// URL.' : null)
  }

  const importFromLink = async () => {
    if (!isSafeUrl(formData.job_link) || !formData.job_link) {
      setUrlError('Enter a valid job link first.')
      return
    }

    setImporting(true)
    try {
      const response = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.job_link }),
      })
      const result = await response.json() as Record<string, string>
      if (!response.ok) throw new Error(result.error)
      setFormData((previous) => ({
        ...previous,
        job_title: result.job_title || previous.job_title,
        company: result.company || previous.company,
        job_link: result.job_link || previous.job_link,
        location: result.location || previous.location,
        source: result.source || previous.source,
        notes: result.notes || previous.notes,
      }))
    } catch (error) {
      onError(error instanceof Error && error.message ? error.message : 'Could not import this job.')
    } finally {
      setImporting(false)
    }
  }

  const handleResume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf' || file.name.split('.').pop()?.toLowerCase() !== 'pdf') {
      onError('Only PDF resumes are supported.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      onError('Resume must be under 5 MB.')
      event.target.value = ''
      return
    }
    setResumeFile(file)
  }

  const uploadResume = async () => {
    if (!resumeFile) return null
    const path = `${userId}/${crypto.randomUUID()}.pdf`
    const { error } = await supabase.storage.from('resumes').upload(path, resumeFile, { upsert: false })
    if (error) throw error
    return path
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!formData.job_title.trim()) {
      onError('Enter a job title.')
      return
    }
    if (!isSafeUrl(formData.job_link)) {
      setUrlError('Enter a valid http:// or https:// URL.')
      return
    }

    setSubmitting(true)
    let uploadedResumePath: string | null = null
    let applicationOwnsUpload = false
    let cleanupWarning: string | null = null

    try {
      uploadedResumePath = await uploadResume()
      const values = { ...formData, job_title: formData.job_title.trim(), ...(uploadedResumePath ? { resume_url: uploadedResumePath } : {}) }
      const query = editJob
        ? supabase.from('job_applications').update(values).eq('id', editJob.id).eq('user_id', userId)
        : supabase.from('job_applications').insert([{ ...values, user_id: userId }])
      const { data, error } = await query.select().single()
      if (error || !data) throw error

      applicationOwnsUpload = Boolean(uploadedResumePath)
      const savedJob = data as JobApplication

      if (!editJob && savedJob.status !== 'Bookmarked') {
        const appliedAt = savedJob.created_at ?? new Date().toISOString()
        const { error: stageError } = await supabase.from('application_stages').insert({
          application_id: savedJob.id,
          user_id: userId,
          name: 'Applied',
          stage_type: 'application',
          position: 0,
          state: 'completed',
          started_at: appliedAt,
          completed_at: appliedAt,
        })

        if (stageError) {
          const { error: rollbackError } = await supabase.from('job_applications').delete().eq('id', savedJob.id).eq('user_id', userId)
          if (!rollbackError) applicationOwnsUpload = false
          throw stageError
        }
      }

      if (editJob && uploadedResumePath && editJob.resume_url) {
        const previousPath = resumeStoragePath(editJob.resume_url)
        if (previousPath && previousPath !== uploadedResumePath) {
          const { error: cleanupError } = await supabase.storage.from('resumes').remove([previousPath])
          if (cleanupError) {
            console.error('Previous resume cleanup failed:', cleanupError)
            cleanupWarning = 'Application updated, but the previous resume file could not be removed.'
          }
        }
      }

      onSuccess(savedJob)
      setOpen(false)
      if (cleanupWarning) onError(cleanupWarning)
    } catch {
      if (uploadedResumePath && !applicationOwnsUpload) {
        const { error: cleanupError } = await supabase.storage.from('resumes').remove([uploadedResumePath])
        if (cleanupError) console.error('Resume rollback cleanup failed:', cleanupError)
      }
      onError(editJob ? 'Failed to update application.' : 'Failed to add application.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden border border-slate-700 bg-slate-900 p-0 text-slate-100">
        <DialogHeader className="border-b border-slate-800 p-5 sm:p-7">
          <DialogTitle className="text-xl font-bold sm:text-2xl">{editJob ? 'Edit application' : 'Add application'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
            {!editJob && (
              <section className="space-y-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-200"><Sparkles className="h-4 w-4" />Import job details</div>
                <Label htmlFor="import-job-link">Job posting URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="import-job-link" type="url" value={formData.job_link} onChange={(event) => handleLink(event.target.value)} className="min-w-0 bg-slate-950/60 border-slate-700" />
                  <Button type="button" onClick={importFromLink} disabled={importing || !formData.job_link} className="bg-blue-600 hover:bg-blue-700 sm:flex-shrink-0">
                    {importing ? 'Importing…' : 'Import'}
                  </Button>
                </div>
              </section>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="job_title">Job title</Label><Input id="job_title" required maxLength={200} value={formData.job_title} onChange={(event) => field('job_title', event.target.value)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-2"><Label htmlFor="company">Company</Label><Input id="company" maxLength={200} value={formData.company} onChange={(event) => field('company', event.target.value)} className="bg-slate-800 border-slate-700" /></div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="job_link">Job link</Label><Input id="job_link" type="url" maxLength={2048} value={formData.job_link} onChange={(event) => handleLink(event.target.value)} className="bg-slate-800 border-slate-700" />{urlError && <p role="alert" className="text-xs text-red-400">{urlError}</p>}</div>
              <div className="space-y-2"><Label>Status</Label><Select value={formData.status} onValueChange={(value) => field('status', value as JobApplication['status'])}><SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-700">{(['Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'] as const).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" maxLength={200} value={formData.location} onChange={(event) => field('location', event.target.value)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-2"><Label htmlFor="source">Source</Label><Input id="source" maxLength={200} value={formData.source} onChange={(event) => field('source', event.target.value)} className="bg-slate-800 border-slate-700" /></div>
            </div>

            <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={5} maxLength={5000} value={formData.notes} onChange={(event) => field('notes', event.target.value)} className="resize-none bg-slate-800 border-slate-700" /></div>

            <div className="space-y-2">
              <Label>Resume PDF</Label>
              {resumeFile ? (
                <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-700 bg-slate-800 p-3"><Paperclip className="h-4 w-4 flex-shrink-0 text-emerald-400" /><span className="min-w-0 flex-1 truncate text-sm">{resumeFile.name}</span><button type="button" onClick={() => setResumeFile(null)} aria-label="Remove resume" className="flex-shrink-0"><X className="h-4 w-4" /></button></div>
              ) : (
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-slate-600 bg-slate-800 p-3"><Paperclip className="h-4 w-4" /><span className="text-sm text-slate-300">Choose PDF</span><input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={handleResume} /></label>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-slate-700">Cancel</Button>
              <Button type="submit" disabled={submitting || importing || Boolean(urlError)} className="bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-600">{submitting ? 'Saving…' : editJob ? 'Save changes' : 'Add application'}</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
