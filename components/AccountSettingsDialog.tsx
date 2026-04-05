'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Settings, Download, Trash2, AlertTriangle,
  CheckCircle2, User, Mail, Shield,
} from 'lucide-react'

interface Props {
  open: boolean
  setOpen: (v: boolean) => void
  jobs: JobApplication[]
  userId: string
  userEmail: string
  userName: string | null
  onDataDeleted: () => void
}

function exportToCSV(jobs: JobApplication[]) {
  const headers = [
    'Company', 'Role', 'Location', 'Status',
    'Date Applied', 'Job Link', 'Resume URL', 'Source', 'Notes',
  ]
  const rows = jobs.map((j) => [
    j.company ?? '',
    j.job_title ?? '',
    j.location ?? '',
    j.status ?? '',
    j.date_applied ?? '',
    j.job_link ?? '',
    j.resume_url ?? '',
    j.source ?? '',
    (j.notes ?? '').replace(/\n/g, ' | '),
  ])

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `job-applications-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AccountSettingsDialog({
  open, setOpen, jobs, userId, userEmail, userName, onDataDeleted,
}: Props) {
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle')
  const [confirmInput, setConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const CONFIRM_PHRASE = 'delete my data'
  const canConfirm = confirmInput.trim().toLowerCase() === CONFIRM_PHRASE

  const handleDeleteAll = async () => {
    if (!canConfirm) return
    setDeletePhase('deleting')
    setDeleteError(null)

    try {
      // 1. Collect all resume storage paths
      const resumePaths = jobs
        .map((j) => {
          if (!j.resume_url) return null
          // Extract path after "/object/public/resumes/"
          const match = j.resume_url.match(/\/object\/public\/resumes\/(.+)$/)
          return match ? match[1] : null
        })
        .filter(Boolean) as string[]

      // 2. Delete files from Supabase Storage
      if (resumePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('resumes')
          .remove(resumePaths)
        if (storageError) console.error('Storage deletion error:', storageError)
      }

      // 3. Delete all job_applications rows
      const { error: dbError } = await supabase
        .from('job_applications')
        .delete()
        .eq('user_id', userId)

      if (dbError) throw dbError

      setDeletePhase('done')
      setConfirmInput('')
      onDataDeleted()
    } catch (err) {
      console.error(err)
      setDeleteError('Something went wrong. Please try again.')
      setDeletePhase('confirm')
    }
  }

  const resetDelete = () => {
    setDeletePhase('idle')
    setConfirmInput('')
    setDeleteError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDelete() }}>
      <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-slate-100 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Settings className="w-5 h-5 text-slate-400" />
            Account Settings
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Account info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Account
            </h3>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 divide-y divide-slate-700/50">
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-200">{userEmail}</p>
                </div>
              </div>
              {userName && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Name</p>
                    <p className="text-sm font-medium text-slate-200">{userName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-3">
                <Shield className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Applications tracked</p>
                  <p className="text-sm font-medium text-slate-200">{jobs.length}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Export */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export Data
            </h3>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-200">Export to CSV</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Downloads all {jobs.length} application{jobs.length !== 1 ? 's' : ''} as a spreadsheet.
                  Includes company, role, status, dates, job links, and resume URLs.
                </p>
              </div>
              <Button
                onClick={() => exportToCSV(jobs)}
                disabled={jobs.length === 0}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download CSV ({jobs.length} rows)
              </Button>
            </div>
          </section>

          {/* Danger zone */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
            </h3>

            {deletePhase === 'done' ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">All data deleted</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    All applications and resume files have been permanently removed.
                  </p>
                </div>
              </div>
            ) : deletePhase === 'idle' ? (
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Delete all my data</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Permanently deletes all {jobs.length} application{jobs.length !== 1 ? 's' : ''} and
                    all uploaded resume files from storage. This cannot be undone.
                  </p>
                </div>
                <Button
                  onClick={() => setDeletePhase('confirm')}
                  size="sm"
                  variant="outline"
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  disabled={jobs.length === 0}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete all data
                </Button>
              </div>
            ) : (
              <div className="bg-red-500/8 border border-red-500/30 rounded-xl px-4 py-4 space-y-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-300">Are you absolutely sure?</p>
                    <p className="text-xs text-slate-400 mt-1">
                      This will permanently delete{' '}
                      <span className="font-semibold text-slate-200">{jobs.length} application{jobs.length !== 1 ? 's' : ''}</span>{' '}
                      and all resume files from storage. There is no way to recover this data.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">
                    Type <span className="font-mono font-bold text-slate-200">{CONFIRM_PHRASE}</span> to confirm
                  </label>
                  <Input
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-600 h-9 text-sm"
                    disabled={deletePhase === 'deleting'}
                  />
                </div>
                {deleteError && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAll}
                    disabled={!canConfirm || deletePhase === 'deleting'}
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40"
                  >
                    {deletePhase === 'deleting' ? (
                      <><span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin mr-1.5" />Deleting…</>
                    ) : (
                      <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Yes, delete everything</>
                    )}
                  </Button>
                  <Button
                    onClick={resetDelete}
                    size="sm"
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    disabled={deletePhase === 'deleting'}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={() => { setOpen(false); resetDelete() }}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
