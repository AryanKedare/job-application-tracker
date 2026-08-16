'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
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
    return supabase.storage.from('resumes').getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isSafeUrl(formData.job_link)) {
      setUrlError('Enter a valid http:// or https:// URL.')
      return
    }
    setSubmitting(true)
    try {
      const resumeUrl = await uploadResume()
      const values = { ...formData, ...(resumeUrl ? { resume_url: resumeUrl } : {}) }
      const query = editJob
        ? supabase.from('job_applications').update(values).eq('id', editJob.id).eq('user_id', userId)
        : supabase.from('job_applications').insert([{ ...values, user_id: userId }])
      const { data, error } = await query.select().single()
      if (error || !data) throw error

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
          await supabase.from('job_applications').delete().eq('id', savedJob.id).eq('user_id', userId)
          throw stageError
        }
      }

      onSuccess(savedJob)
      setOpen(false)
    } catch {
      onError(editJob ? 'Failed to update application.' : 'Failed to add application.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader className="p-8 pb-6 border-b border-slate-800">
          <DialogTitle className="text-2xl font-bold">{editJob ? 'Edit Application' : 'Add New Application'}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {!editJob && (
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-200"><Sparkles className="h-4 w-4" /> Fill with Groq AI</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input type="url" placeholder="Paste the job posting link" value={formData.job_link}
                    onChange={(e) => handleLink(e.target.value)} className="bg-slate-950/60 border-slate-700" />
                  <Button type="button" onClick={importFromLink} disabled={importing || !formData.job_link}
                    className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
                    {importing ? 'Reading job…' : 'Auto-fill details'}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">Review the extracted information before saving.</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="job_title">Job Title *</Label><Input id="job_title" required maxLength={200} value={formData.job_title} onChange={(e) => field('job_title', e.target.value)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-2"><Label htmlFor="company">Company</Label><Input id="company" maxLength={200} value={formData.company} onChange={(e) => field('company', e.target.value)} className="bg-slate-800 border-slate-700" /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="job_link">Job Link</Label><Input id="job_link" type="url" maxLength={2048} value={formData.job_link} onChange={(e) => handleLink(e.target.value)} className="bg-slate-800 border-slate-700" />{urlError && <p className="text-xs text-red-400">{urlError}</p>}</div>
              <div className="space-y-2"><Label>Status</Label><Select value={formData.status} onValueChange={(value) => field('status', value as JobApplication['status'])}><SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-700">{(['Bookmarked','Applied','Interviewing','Offer','Rejected','Ghosted'] as const).map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" maxLength={200} value={formData.location} onChange={(e) => field('location', e.target.value)} className="bg-slate-800 border-slate-700" /></div>
              <div className="space-y-2"><Label htmlFor="source">Source</Label><Input id="source" maxLength={200} value={formData.source} onChange={(e) => field('source', e.target.value)} className="bg-slate-800 border-slate-700" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={5} maxLength={5000} value={formData.notes} onChange={(e) => field('notes', e.target.value)} className="bg-slate-800 border-slate-700 resize-none" /></div>
            <div className="space-y-2">
              <Label>Resume (PDF, max 5 MB)</Label>
              {resumeFile ? <div className="flex items-center gap-3 p-3 rounded-md bg-slate-800 border border-slate-700"><Paperclip className="h-4 w-4 text-emerald-400" /><span className="text-sm truncate flex-1">{resumeFile.name}</span><button type="button" onClick={() => setResumeFile(null)} aria-label="Remove resume"><X className="h-4 w-4" /></button></div>
                : <label className="flex items-center gap-3 p-3 rounded-md bg-slate-800 border border-dashed border-slate-600 cursor-pointer"><Paperclip className="h-4 w-4" /><span className="text-sm text-slate-400">Attach resume PDF</span><input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={handleResume} /></label>}
            </div>
            <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-slate-700">Cancel</Button><Button type="submit" disabled={submitting || importing || !!urlError} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold">{submitting ? 'Saving…' : editJob ? 'Save changes' : 'Add Application'}</Button></div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
