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
import { Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'

interface AddJobDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  onSuccess: () => void
}

export default function AddJobDialog({
  open,
  setOpen,
  onSuccess,
}: AddJobDialogProps) {
  const [formData, setFormData] = useState({
    job_title: '',
    company: '',
    job_link: '',
    status: 'Bookmarked' as JobApplication['status'],
    location: '',
    source: '',
    notes: '',
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        alert('You need to be logged in to add applications.')
        setLoading(false)
        return
      }

      let resumeUrl: string | null = null

      if (resumeFile) {
        const ext = resumeFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, resumeFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(fileName)

        resumeUrl = urlData.publicUrl
      }

      const payload = {
        job_title: formData.job_title,
        company: formData.company,
        job_link: formData.job_link,
        status: formData.status,
        location: formData.location,
        source: formData.source,
        notes: formData.notes,
        resume_url: resumeUrl,
        user_id: user.id,
      }

      const { error: insertError } = await supabase
        .from('job_applications')
        .insert([payload])

      if (insertError) {
        console.error(insertError)
        alert('Failed to save job.')
      } else {
        setFormData({
          job_title: '',
          company: '',
          job_link: '',
          status: 'Bookmarked',
          location: '',
          source: '',
          notes: '',
        })
        setResumeFile(null)
        setOpen(false)
        onSuccess()
      }
    } catch (err) {
      console.error(err)
      alert('Unexpected error while saving job.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="p-8 pb-6 border-b bg-gradient-to-r from-blue-50/5 to-indigo-50/5">
          <DialogTitle className="text-2xl font-bold text-slate-50">
            Add New Job Application
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Job details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="job_title">Job Title *</Label>
              <Input
                id="job_title"
                required
                value={formData.job_title}
                onChange={(e) =>
                  setFormData({ ...formData, job_title: e.target.value })
                }
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                className="h-11"
              />
            </div>
          </div>

          {/* Link & status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="job_link">Job Link</Label>
              <Input
                id="job_link"
                type="url"
                value={formData.job_link}
                onChange={(e) =>
                  setFormData({ ...formData, job_link: e.target.value })
                }
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as JobApplication['status'],
                  })
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bookmarked">Bookmarked</SelectItem>
                  <SelectItem value="Applied">Applied</SelectItem>
                  <SelectItem value="Interviewing">Interviewing</SelectItem>
                  <SelectItem value="Offer">Offer</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Ghosted">Ghosted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location & source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
                className="h-11"
              />
            </div>
          </div>

          {/* Resume upload */}
          <div className="space-y-2">
            <Label>Resume (PDF/DOC/DOCX)</Label>
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 hover:border-emerald-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) =>
                  setResumeFile(e.target.files?.[0] || null)
                }
                className="hidden"
                id="resume-upload"
              />
              <label
                htmlFor="resume-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-10 h-10 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {resumeFile?.name || 'Upload resume'}
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF, DOC, DOCX – max 5 MB
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="resize-vertical"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-11 px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {loading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {loading ? 'Saving…' : 'Add application'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
