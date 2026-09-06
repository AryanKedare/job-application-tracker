'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ApplicationStage, JobApplication } from '@/lib/types'
import { formatLocalDate, formatLocalDateTime } from '@/lib/date'
import { resumeStoragePath, spreadsheetSafe } from '@/lib/resume-storage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MonthlyAnalysisToggle from '@/components/MonthlyAnalysisToggle'
import { Settings, Download, Trash2, AlertTriangle, CheckCircle2, User, Mail, Shield, BellRing, Sparkles } from 'lucide-react'

interface Props {
  open: boolean
  setOpen: (v: boolean) => void
  jobs: JobApplication[]
  userId: string
  userEmail: string
  userName: string | null
  onDataDeleted: () => void
}

type ExportStage = Pick<ApplicationStage, 'application_id' | 'name' | 'position' | 'state' | 'started_at' | 'completed_at' | 'created_at'>

function formatLifecycleStage(stage: ExportStage) {
  const timestamps = [
    stage.started_at ? `started ${formatLocalDateTime(stage.started_at)}` : '',
    stage.completed_at ? `finished ${formatLocalDateTime(stage.completed_at)}` : '',
  ].filter(Boolean).join('; ')
  return `${stage.name} [${stage.state}]${timestamps ? ` (${timestamps})` : ''}`
}

function currentOrLastStage(stages: ExportStage[]) {
  return stages.find((stage) => stage.state === 'current')?.name
    ?? [...stages].reverse().find((stage) => stage.state !== 'pending')?.name
    ?? stages[0]?.name
    ?? ''
}

async function exportToCSV(jobs: JobApplication[], userId: string) {
  const { data, error } = await supabase
    .from('application_stages')
    .select('application_id,name,position,state,started_at,completed_at,created_at')
    .eq('user_id', userId)
    .order('position')
    .order('created_at')

  if (error) throw error

  const stagesByApplication = new Map<string, ExportStage[]>()
  for (const stage of (data ?? []) as ExportStage[]) {
    const stages = stagesByApplication.get(stage.application_id) ?? []
    stages.push(stage)
    stagesByApplication.set(stage.application_id, stages)
  }

  const headers = ['Company', 'Role', 'Location', 'Status', 'Current / Last Stage', 'Application Lifecycle', 'Date Applied', 'Job Link', 'Resume Storage Path', 'Source', 'Notes']
  const rows = jobs.map((job) => {
    const stages = (stagesByApplication.get(job.id) ?? []).sort((a, b) => a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    return [
      job.company ?? '', job.job_title ?? '', job.location ?? '', job.status ?? '', currentOrLastStage(stages),
      stages.map(formatLifecycleStage).join(' → '), formatLocalDateTime(job.date_applied), job.job_link ?? '',
      resumeStoragePath(job.resume_url) ?? '', job.source ?? '', (job.notes ?? '').replace(/\n/g, ' | '),
    ]
  })

  const escape = (value: string) => {
    const safe = spreadsheetSafe(value)
    return `"${safe.replace(/"/g, '""')}"`
  }
  const csvContent = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `job-applications-${formatLocalDate(new Date()).replaceAll('/', '-')}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function AccountSettingsDialog({ open, setOpen, jobs, userId, userEmail, userName, onDataDeleted }: Props) {
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle')
  const [confirmInput, setConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [analysisSending, setAnalysisSending] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [emailUpdatesEnabled, setEmailUpdatesEnabled] = useState(true)
  const [preferenceLoading, setPreferenceLoading] = useState(false)
  const [preferenceSaving, setPreferenceSaving] = useState(false)
  const [preferenceMessage, setPreferenceMessage] = useState<{ text: string; error: boolean } | null>(null)

  const CONFIRM_PHRASE = 'delete my data'
  const canConfirm = confirmInput.trim().toLowerCase() === CONFIRM_PHRASE

  useEffect(() => {
    if (!open || !userId) return
    let active = true

    const loadPreference = async () => {
      setPreferenceLoading(true)
      setPreferenceMessage(null)
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user || user.id !== userId) throw error ?? new Error('User session is unavailable.')
        if (active) setEmailUpdatesEnabled(user.user_metadata?.email_updates_enabled !== false)
      } catch (error) {
        console.error('Email preference load failed:', error)
        if (active) setPreferenceMessage({ text: 'Could not load your email preference.', error: true })
      } finally {
        if (active) setPreferenceLoading(false)
      }
    }

    void loadPreference()
    return () => { active = false }
  }, [open, userId])

  const handleEmailPreferenceChange = async (enabled: boolean) => {
    const previousValue = emailUpdatesEnabled
    setEmailUpdatesEnabled(enabled)
    setPreferenceSaving(true)
    setPreferenceMessage(null)
    try {
      const { data: { user }, error: getError } = await supabase.auth.getUser()
      if (getError || !user || user.id !== userId) throw getError ?? new Error('User session is unavailable.')

      const { error } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          email_updates_enabled: enabled,
          email_updates_changed_at: new Date().toISOString(),
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Email preference save failed:', error)
      setEmailUpdatesEnabled(previousValue)
      setPreferenceMessage({ text: 'Could not save your email preference. Please try again.', error: true })
    } finally {
      setPreferenceSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    setExportSuccess(null)
    try {
      await exportToCSV(jobs, userId)
      setExportSuccess('CSV export created successfully.')
    } catch (error) {
      console.error('CSV export error:', error)
      setExportError('Could not export your applications. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleAnalysisReport = async () => {
    setAnalysisSending(true)
    setAnalysisMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken) throw new Error('Your session is unavailable. Please sign in again.')

      const response = await fetch('/api/analysis-report', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'same-origin',
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; email?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not generate the analysis report.')

      setAnalysisMessage({
        text: `Analysis PDF sent to ${payload.email || userEmail}.`,
        error: false,
      })
    } catch (error) {
      console.error('Application analysis request failed:', error)
      setAnalysisMessage({
        text: error instanceof Error ? error.message : 'Could not generate the analysis report.',
        error: true,
      })
    } finally {
      setAnalysisSending(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!canConfirm) return
    setDeletePhase('deleting')
    setDeleteError(null)

    try {
      const resumePaths = jobs.map((job) => resumeStoragePath(job.resume_url)).filter((path): path is string => Boolean(path))
      if (resumePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from('resumes').remove(resumePaths)
        if (storageError) throw new Error(`Resume deletion failed: ${storageError.message}`)
      }

      const { error: dbError } = await supabase.from('job_applications').delete().eq('user_id', userId)
      if (dbError) throw dbError

      setDeletePhase('done')
      setConfirmInput('')
      onDataDeleted()
    } catch (error) {
      console.error(error)
      setDeleteError('Could not delete all data. Please try again.')
      setDeletePhase('confirm')
    }
  }

  const resetDelete = () => {
    setDeletePhase('idle')
    setConfirmInput('')
    setDeleteError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetDelete() }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden border border-slate-700 bg-slate-900 p-0 text-slate-100">
        <DialogHeader className="border-b border-slate-800 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold"><Settings className="h-5 w-5 text-slate-400" />Account settings</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-x-hidden overflow-y-auto px-5 py-5 sm:px-6">
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><User className="h-3.5 w-3.5" />Account</h3>
            <div className="divide-y divide-slate-700/50 rounded-xl border border-slate-700/50 bg-slate-800/60">
              <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-slate-500" />
                <div className="min-w-0"><p className="text-xs text-slate-500">Email</p><a href={`mailto:${userEmail}`} className="block truncate text-sm font-medium text-blue-300 hover:text-blue-200">{userEmail}</a></div>
              </div>
              {userName && <div className="flex min-w-0 items-center gap-3 px-4 py-3"><User className="h-4 w-4 flex-shrink-0 text-slate-500" /><div className="min-w-0"><p className="text-xs text-slate-500">Name</p><p className="truncate text-sm font-medium text-slate-200">{userName}</p></div></div>}
              <div className="flex items-center gap-3 px-4 py-3"><Shield className="h-4 w-4 flex-shrink-0 text-slate-500" /><div><p className="text-xs text-slate-500">Applications tracked</p><p className="text-sm font-medium text-slate-200">{jobs.length}</p></div></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><BellRing className="h-3.5 w-3.5" />Email preferences</h3>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-200">Product updates and changelogs</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailUpdatesEnabled}
                  aria-label="Product update emails"
                  disabled={preferenceLoading || preferenceSaving}
                  onClick={() => void handleEmailPreferenceChange(!emailUpdatesEnabled)}
                  className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ease-out disabled:cursor-not-allowed ${emailUpdatesEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${emailUpdatesEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {preferenceMessage?.error && <p role="alert" className="mt-2 text-xs text-red-400">{preferenceMessage.text}</p>}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><Sparkles className="h-3.5 w-3.5" />AI analysis</h3>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-200">Application insights PDF</p>
                <Button
                  onClick={() => void handleAnalysisReport()}
                  disabled={jobs.length === 0 || analysisSending}
                  size="sm"
                  className="flex-shrink-0 bg-violet-600 font-semibold text-white hover:bg-violet-700"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />{analysisSending ? 'Generating…' : 'Email PDF'}
                </Button>
              </div>
              {analysisMessage && <p role={analysisMessage.error ? 'alert' : 'status'} className={`mt-2 text-xs ${analysisMessage.error ? 'text-red-400' : 'text-emerald-400'}`}>{analysisMessage.text}</p>}
              <MonthlyAnalysisToggle userId={userId} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><Download className="h-3.5 w-3.5" />Export data</h3>
            <div className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-4">
              <p className="text-sm font-medium text-slate-200">CSV export</p>
              {exportError && <p role="alert" className="text-xs text-red-400">{exportError}</p>}
              {exportSuccess && <p role="status" className="text-xs text-emerald-400">{exportSuccess}</p>}
              <Button onClick={() => void handleExport()} disabled={jobs.length === 0 || exporting} size="sm" className="bg-blue-600 font-semibold text-white hover:bg-blue-700">
                <Download className="mr-1.5 h-3.5 w-3.5" />{exporting ? 'Preparing…' : `Download CSV (${jobs.length})`}
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-400"><AlertTriangle className="h-3.5 w-3.5" />Danger zone</h3>

            {deletePhase === 'done' ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4"><CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" /><div><p className="text-sm font-semibold text-emerald-300">All data deleted</p><p className="mt-0.5 text-xs text-slate-400">Applications and resume files were removed.</p></div></div>
            ) : deletePhase === 'idle' ? (
              <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-4"><p className="text-sm font-semibold text-slate-200">Delete all my data</p><Button onClick={() => setDeletePhase('confirm')} size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300" disabled={jobs.length === 0}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete all data</Button></div>
            ) : (
              <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-4">
                <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" /><div><p className="text-sm font-semibold text-red-300">Confirm permanent deletion</p><p className="mt-1 text-xs text-slate-400">Type <span className="font-mono font-bold text-slate-200">{CONFIRM_PHRASE}</span>.</p></div></div>
                <Input aria-label="Deletion confirmation" value={confirmInput} onChange={(event) => setConfirmInput(event.target.value)} className="h-9 bg-slate-900 border-slate-600 text-sm text-slate-100" disabled={deletePhase === 'deleting'} />
                {deleteError && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{deleteError}</p>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button onClick={resetDelete} size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" disabled={deletePhase === 'deleting'}>Cancel</Button>
                  <Button onClick={() => void handleDeleteAll()} disabled={!canConfirm || deletePhase === 'deleting'} size="sm" className="bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-40">{deletePhase === 'deleting' ? 'Deleting…' : 'Delete everything'}</Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-800 px-5 py-4 sm:px-6"><Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => { setOpen(false); resetDelete() }}>Close</Button></div>
      </DialogContent>
    </Dialog>
  )
}
