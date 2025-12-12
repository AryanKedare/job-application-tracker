'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, Download, Edit3, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'

interface JobCardProps {
  job: JobApplication
  onUpdate: () => void
}

export default function JobCard({ job, onUpdate }: JobCardProps) {
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
    <Card className="group/job hover:shadow-xl transition-all border-0 bg-gradient-to-br from-white/90 to-blue-50/50 backdrop-blur-sm hover:-translate-y-1 hover:scale-[1.02] overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold line-clamp-1 group-hover/job:line-clamp-none">{job.job_title}</CardTitle>
        <CardDescription className="font-semibold text-blue-600">{job.company}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-4 space-y-3">
        {job.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            📍 {job.location}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            {job.status}
          </span>
          {job.source && (
            <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
              {job.source}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {job.job_link && (
            <Button variant="outline" size="sm" asChild className="h-9">
              <a href={job.job_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <ExternalLink className="w-4 h-4" />
                View Job
              </a>
            </Button>
          )}
          {job.resume_url && (
            <Button variant="ghost" size="sm" asChild className="h-9 border-dashed">
              <a href={job.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                <Download className="w-4 h-4" />
                Resume
              </a>
            </Button>
          )}
        </div>
        {job.notes && (
          <p className="text-xs text-gray-600 line-clamp-2">{job.notes}</p>
        )}
      </CardContent>
    </Card>
  )
}
