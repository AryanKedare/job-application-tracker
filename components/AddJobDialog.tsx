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

interface AddJobDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  /** Called with the newly created or updated job */
  onSuccess: (job: JobApplication) => void
  /** Called when the insert/update fails */
  onError: (message: string) => void
  /** The current user's id — used for RLS defence-in-depth */
  userId: string
  /** Optional: existing job to pre-fill fields for editing */
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    if (editJob) {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ ...formData })
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
        .insert([{ ...formData, user_id: userId }])
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
    setOpen(false)
  }

  const field = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader className="p-8 pb-6 border-b border-slate-800">
          <DialogTitle className="text-2xl font-bold">
            {editJob ? 'Edit Application' : 'Add New Application'}
          </DialogTitle>
        </DialogHeader>

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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              placeholder="Interview notes, follow-up dates, contacts..."
              value={formData.notes}
              onChange={(e) => field('notes', e.target.value)}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
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
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
            >
              {submitting ? 'Saving…' : editJob ? 'Save changes' : 'Add Application'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
