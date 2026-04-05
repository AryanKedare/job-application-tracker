// components/AddJobDialog.tsx
'use client'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import { Paperclip, X } from 'lucide-react'

interface AddJobDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  onSuccess: (job: JobApplication) => void
  onError: (message: string) => void
  userId: string
  editJob?: JobApplication | null
}

const EMPTY_FORM = {
  job_title: '',
  company: '',
  job_link: '',
  status: 'Bookmarked' as JobApplication['status'],
  location: '',
  source: '',
  notes: '',
}

export default function AddJobDialog({
  open,
  setOpen,
  onSuccess,
  onError,
  userId,
  editJob,
}: AddJobDialogProps) {
  const [formData, setFormData] = useState(
    editJob
      ? {
          job_title: editJob.job_title,
          company: editJob.company,
          job_link: editJob.job_link ?? '',
          status: editJob.status,
          location: editJob.location ?? '',
          source: editJob.source ?? '',
          notes: editJob.notes ?? '',
        }
      : EMPTY_FORM,
  )
  const [submitting, setSubmitting] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploadingResume, setUploadingResume] = useState(false)

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      onError('Only PDF files are supported for resume upload.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onError('Resume must be under 5MB.')
      return
    }
    setResumeFile(file)
  }

  // Uploads the file to Storage and returns the public URL, or null on failure
  const uploadResume = async (): Promise<string | null> => {
    if (!resumeFile) return null
    setUploadingResume(true)
    const filePath = `${userId}/${resumeFile.name}`
    const { error } = await supabase.storage
      .from('resumes')
      .upload(filePath, resumeFile, { upsert: true })
    setUploadingResume(false)
    if (error) {
      onError('Resume upload failed. The application was saved without it.')
      return null
    }
    const { data } = supabase.storage.from('resumes').getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    // Upload resume first so we have the URL ready for the DB row
    const resumeUrl = resumeFile ? await uploadResume() : null
    const resumeField = resumeUrl ? { resume_url: resumeUrl } : {}

    if (editJob) {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ ...formData, ...resumeField })
        .eq('id', editJob.id)
        .eq('user_id', userId)
        .select()
        .single()

      setSubmitting(false)
      if (error || !data) {
        onError('Failed to update application. Please try again.')
        return
      }
      onSuccess(data as JobApplication)
    } else {
      const { data, error } = await supabase
        .from('job_applications')
        .insert([{ ...formData, user_id: userId, ...resumeField }])
        .select()
        .single()

      setSubmitting(false)
      if (error || !data) {
        onError('Failed to add application. Please try again.')
        return
      }
      onSuccess(data as JobApplication)
    }

    setFormData(EMPTY_FORM)
    setResumeFile(null)
    setOpen(false)
  }

  const field = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 bg-slate-900 border border-slate-700 text-slate-100">
        {/* Fixed header */}
        <DialogHeader className="flex-shrink-0 p-8 pb-6 border-b border-slate-800">
          <DialogTitle className="text-2xl font-bold">
            {editJob ? 'Edit Application' : 'Add New Application'}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title *</Label>
                <Input
                  id="job_title"
                  required
                  value={formData.job_title}
                  onChange={(e) => field('job_title', e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => field('company', e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="job_link">Job Link</Label>
                <Input
                  id="job_link"
                  type="url"
                  value={formData.job_link}
                  onChange={(e) => field('job_link', e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => field('status', v as JobApplication['status'])}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {(['Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted'] as const).map(
                      (s) => <SelectItem key={s} value={s}>{s}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => field('location', e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={formData.source}
                  onChange={(e) => field('source', e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            {/* Notes - fixed height with internal scroll */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Interview notes, follow-up dates, contacts..."
                value={formData.notes}
                onChange={(e) => field('notes', e.target.value)}
                className="bg-slate-800 border-slate-700 resize-none h-28 overflow-y-auto"
              />
            </div>

            {/* Resume upload */}
            <div className="space-y-2">
              <Label>Resume (PDF, max 5MB)</Label>
              {resumeFile ? (
                <div className="flex items-center gap-3 p-3 rounded-md bg-slate-800 border border-slate-700">
                  <Paperclip className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200 truncate flex-1">{resumeFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setResumeFile(null)}
                    className="text-slate-400 hover:text-slate-200 flex-shrink-0"
                    aria-label="Remove resume"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="resume_upload"
                  className="flex items-center gap-3 p-3 rounded-md bg-slate-800 border border-dashed border-slate-600 cursor-pointer hover:border-slate-400 transition-colors"
                >
                  <Paperclip className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-400">Click to attach resume PDF</span>
                  <input
                    id="resume_upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    onChange={handleResumeChange}
                  />
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 pb-2">
              <Button
                type="button"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || uploadingResume}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
              >
                {uploadingResume
                  ? 'Uploading resume…'
                  : submitting
                  ? 'Saving…'
                  : editJob
                  ? 'Save changes'
                  : 'Add Application'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
