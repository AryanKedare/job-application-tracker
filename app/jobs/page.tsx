'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import AddJobDialog from '@/components/AddJobDialog'
import { ArrowLeft, Plus, Download, ExternalLink } from 'lucide-react'
import Link from 'next/link'

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
        .select('*')
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

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
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
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/90 border-b border-slate-800">
                <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Apply</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Resume</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-100">
                        {job.company || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-50">
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
                        className="bg-slate-900 border border-slate-700 text-xs rounded-full px-2.5 py-1 text-slate-100"
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
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {job.date_applied
                        ? new Date(job.date_applied).toLocaleDateString()
                        : '—'}
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
                      colSpan={8}
                      className="px-4 py-16 text-center text-slate-500"
                    >
                      No applications yet. Click “Add application” to create
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
  )
}
