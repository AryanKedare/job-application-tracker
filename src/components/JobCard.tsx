'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Download, Edit3, Trash2, StickyNote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface JobCardProps {
  job: JobApplication
  onUpdate: () => void
}

export default function JobCard({ job, onUpdate }: JobCardProps) {
  const [notesOpen, setNotesOpen] = useState(false)

  const updateStatus = async (newStatus: JobApplication['status']) => {
    await supabase
      .from('job_applications')
      .update({ status: newStatus })
      .eq('id', job.id)

    onUpdate()
  }

  const deleteJob = async () => {
    if (confirm('Delete this application?')) {
      await supabase.from('job_applications').delete().eq('id', job.id)
      onUpdate()
    }
  }

  return (
    <>
      <Card className="flex flex-col justify-between">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{job.job_title}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {job.status}
            </span>
          </CardTitle>
          <CardDescription className="flex items-center justify-between gap-2">
            <span>{job.company}</span>
            {job.location && (
              <span className="text-xs text-muted-foreground">📍 {job.location}</span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* Source / links / notes */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {job.source && (
              <span className="text-xs text-muted-foreground">
                Source: {job.source}
              </span>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {job.job_link && (
                <Button variant="outline" size="sm" asChild>
                  <a href={job.job_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    View Job
                  </a>
                </Button>
              )}

              {job.resume_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={job.resume_url} target="_blank" rel="noreferrer">
                    <Download className="mr-1 h-3 w-3" />
                    Resume
                  </a>
                </Button>
              )}

              {job.notes && job.notes.trim().length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotesOpen(true)}
                >
                  <StickyNote className="mr-1 h-3 w-3" />
                  View notes
                </Button>
              )}
            </div>
          </div>

          {/* Quick status + actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick status:</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateStatus('Applied')}
              >
                Applied
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateStatus('Interviewing')}
              >
                Interviewing
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateStatus('Offer')}
              >
                Offer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateStatus('Rejected')}
              >
                Rejected
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Reserved for future edit flow */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit application"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete application"
                onClick={deleteJob}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes for {job.job_title}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Company:{' '}
              <span className="font-medium text-foreground">{job.company}</span>
            </p>
            <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
              {job.notes || 'No notes added yet.'}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

