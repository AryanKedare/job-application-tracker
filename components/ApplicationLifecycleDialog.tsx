'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Circle, Clock3, ListTree, Play, Plus, SkipForward, Trash2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ApplicationStage, ApplicationStageEvent, JobApplication } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  open: boolean
  setOpen: (open: boolean) => void
  job: JobApplication
  userId: string
  onChanged: () => void | Promise<void>
  onError: (message: string) => void
}

const PRESETS = [
  ['recruiter-screening', 'Recruiter Screening', 'screening'],
  ['hr-interview', 'HR Interview', 'interview'],
  ['phone-screen', 'Phone Screen', 'screening'],
  ['assessment', 'Assessment', 'assessment'],
  ['online-assessment', 'Online Assessment', 'assessment'],
  ['coding-assessment', 'Coding Assessment', 'coding'],
  ['technical-interview', 'Technical Interview', 'interview'],
  ['interview-round-1', 'Interview Round 1', 'interview'],
  ['interview-round-2', 'Interview Round 2', 'interview'],
  ['interview-round-3', 'Interview Round 3', 'interview'],
  ['technical-round-1', 'Technical Interview - Round 1', 'interview'],
  ['technical-round-2', 'Technical Interview - Round 2', 'interview'],
  ['technical-round-3', 'Technical Interview - Round 3', 'interview'],
  ['hiring-manager', 'Hiring Manager Interview', 'interview'],
  ['behavioural', 'Behavioural Interview', 'interview'],
  ['system-design', 'System Design Interview', 'interview'],
  ['culture-fit', 'Culture Fit', 'interview'],
  ['final-interview', 'Final Interview', 'interview'],
  ['reference-check', 'Reference Check', 'verification'],
  ['background-check', 'Background Check', 'verification'],
  ['offer-discussion', 'Offer Discussion', 'offer'],
  ['custom', 'Custom stage…', 'custom'],
] as const

const EVENT_LABEL: Record<string, string> = {
  application_created: 'Application created', application_imported: 'Application imported into lifecycle',
  stage_added: 'Stage added', stage_started: 'Stage started', stage_completed: 'Stage completed',
  stage_skipped: 'Stage skipped', stage_rejected: 'Rejected at stage', stage_renamed: 'Stage renamed',
  stage_reset: 'Stage reset', status_changed: 'Application status changed',
}

const stateTone: Record<ApplicationStage['state'], string> = {
  pending: 'text-slate-400 border-slate-700', current: 'text-yellow-300 border-yellow-500/40',
  completed: 'text-emerald-300 border-emerald-500/40', skipped: 'text-slate-500 border-slate-700',
  rejected: 'text-red-300 border-red-500/40',
}

function fmt(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ApplicationLifecycleDialog({ open, setOpen, job, userId, onChanged, onError }: Props) {
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [events, setEvents] = useState<ApplicationStageEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [preset, setPreset] = useState('recruiter-screening')
  const [customName, setCustomName] = useState('')
  const [schemaMissing, setSchemaMissing] = useState(false)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setSchemaMissing(false)
    const [s, e] = await Promise.all([
      supabase.from('application_stages').select('*').eq('application_id', job.id).eq('user_id', userId).order('position').order('created_at'),
      supabase.from('application_stage_events').select('*').eq('application_id', job.id).eq('user_id', userId).order('occurred_at', { ascending: false }).limit(100),
    ])
    const error = s.error ?? e.error
    if (error) {
      setSchemaMissing(error.code === '42P01' || error.code === 'PGRST205')
      if (error.code !== '42P01' && error.code !== 'PGRST205') onError('Failed to load the application lifecycle.')
    } else {
      setStages((s.data ?? []) as ApplicationStage[])
      setEvents((e.data ?? []) as ApplicationStageEvent[])
    }
    setLoading(false)
  }, [job.id, onError, open, userId])

  useEffect(() => { void load() }, [load])

  const current = useMemo(() => stages.find((s) => s.state === 'current') ?? null, [stages])
  const rejected = useMemo(() => stages.filter((s) => s.state === 'rejected').sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime())[0] ?? null, [stages])
  const terminal = job.status === 'Offer' || job.status === 'Rejected' || job.status === 'Ghosted'

  const refresh = async () => { await load(); await onChanged() }

  const addStage = async () => {
    const choice = PRESETS.find((p) => p[0] === preset) ?? PRESETS[0]
    const name = choice[0] === 'custom' ? customName.trim() : choice[1]
    if (!name) return onError('Enter a name for the custom stage.')
    setBusy('add')
    const position = stages.length ? Math.max(...stages.map((s) => s.position)) + 1 : 0
    const { error } = await supabase.from('application_stages').insert({ application_id: job.id, user_id: userId, name, stage_type: choice[2], position, state: 'pending' })
    setBusy(null)
    if (error) return onError('Failed to add the application stage.')
    setCustomName('')
    await refresh()
  }

  const updateStage = async (stage: ApplicationStage, values: Partial<ApplicationStage>, errorMessage: string) => {
    setBusy(stage.id)
    const { error } = await supabase.from('application_stages').update(values).eq('id', stage.id).eq('user_id', userId)
    setBusy(null)
    if (error) return onError(errorMessage)
    await refresh()
  }

  const start = async (stage: ApplicationStage) => {
    setBusy(stage.id)
    try {
      if (current && current.id !== stage.id) {
        const { error } = await supabase.from('application_stages').update({ state: 'completed', completed_at: new Date().toISOString() }).eq('id', current.id).eq('user_id', userId)
        if (error) throw error
      }
      const { error } = await supabase.from('application_stages').update({ state: 'current', started_at: stage.started_at ?? new Date().toISOString(), completed_at: null }).eq('id', stage.id).eq('user_id', userId)
      if (error) throw error
      await refresh()
    } catch { onError('Failed to start this stage.'); await load() }
    finally { setBusy(null) }
  }

  const move = async (stage: ApplicationStage, direction: -1 | 1) => {
    const pending = stages.filter((s) => s.state === 'pending').sort((a, b) => a.position - b.position)
    const i = pending.findIndex((s) => s.id === stage.id)
    const other = pending[i + direction]
    if (!other) return
    setBusy(stage.id)
    const first = await supabase.from('application_stages').update({ position: other.position }).eq('id', stage.id).eq('user_id', userId)
    const second = first.error ? first : await supabase.from('application_stages').update({ position: stage.position }).eq('id', other.id).eq('user_id', userId)
    setBusy(null)
    if (first.error || second.error) return onError('Failed to reorder stages.')
    await refresh()
  }

  const remove = async (stage: ApplicationStage) => {
    if (stage.state !== 'pending') return
    setBusy(stage.id)
    const { error } = await supabase.from('application_stages').delete().eq('id', stage.id).eq('user_id', userId)
    setBusy(null)
    if (error) return onError('Failed to delete this stage.')
    await refresh()
  }

  const lastLabel = (job.status === 'Rejected' ? rejected?.name : null) ?? current?.name ?? stages.filter((s) => s.state === 'completed').at(-1)?.name ?? 'No stages yet'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ListTree className="h-5 w-5 text-blue-400" />{job.job_title} lifecycle</DialogTitle><p className="text-sm text-slate-400">{job.company || 'Unknown company'} · {job.status}</p></DialogHeader>

        {schemaMissing ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Run <span className="font-mono">supabase/setup.sql</span> in the Supabase SQL Editor before using stage tracking.</div>
        : loading ? <div className="py-16 flex justify-center"><div className="h-7 w-7 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" /></div>
        : <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-xs uppercase text-slate-500">Status</div><div className="font-semibold mt-1">{job.status}</div></div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:col-span-2"><div className="text-xs uppercase text-slate-500">Current / last stage</div><div className="font-semibold mt-1">{lastLabel}</div></div>
          </div>

          <section className="space-y-3">
            <div><h3 className="font-semibold">Interview & assessment stages</h3><p className="text-xs text-slate-500">Add unlimited named rounds. Complete a round, then explicitly start the next one so the history stays accurate.</p></div>
            {stages.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No stages yet.</div> : <div className="space-y-2">{stages.map((stage, index) => {
              const pending = stages.filter((s) => s.state === 'pending').sort((a, b) => a.position - b.position)
              const pi = pending.findIndex((s) => s.id === stage.id)
              return <div key={stage.id} className={`rounded-xl border p-4 ${stateTone[stage.state]}`}>
                <div className="flex gap-3"><Circle className="h-5 w-5 flex-shrink-0 mt-0.5" /><div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-slate-100">{stage.name}</span><span className="text-[10px] uppercase rounded-full border px-2 py-0.5">{stage.state}</span><span className="text-xs text-slate-600">#{index + 1}</span></div>
                  <div className="text-xs text-slate-500 mt-1">{stage.started_at && <>Started {fmt(stage.started_at)}</>}{stage.started_at && stage.completed_at && ' · '}{stage.completed_at && <>Finished {fmt(stage.completed_at)}</>}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {stage.state === 'pending' && <><Button size="sm" disabled={busy === stage.id || terminal} onClick={() => void start(stage)} className="h-8 bg-blue-600"><Play className="h-3.5 w-3.5 mr-1" />Start</Button><Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'skipped', completed_at: new Date().toISOString() }, 'Failed to skip stage.')} className="h-8 border-slate-700"><SkipForward className="h-3.5 w-3.5 mr-1" />Skip</Button><Button size="icon" variant="outline" disabled={pi <= 0} onClick={() => void move(stage, -1)} className="h-8 w-8 border-slate-700"><ArrowUp className="h-3.5 w-3.5" /></Button><Button size="icon" variant="outline" disabled={pi < 0 || pi >= pending.length - 1} onClick={() => void move(stage, 1)} className="h-8 w-8 border-slate-700"><ArrowDown className="h-3.5 w-3.5" /></Button><Button size="icon" variant="outline" onClick={() => void remove(stage)} className="h-8 w-8 border-slate-700 text-red-300"><Trash2 className="h-3.5 w-3.5" /></Button></>}
                    {stage.state === 'current' && <><Button size="sm" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'completed', completed_at: new Date().toISOString() }, 'Failed to complete stage.')} className="h-8 bg-emerald-600"><Check className="h-3.5 w-3.5 mr-1" />Complete</Button><Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'rejected', completed_at: new Date().toISOString() }, 'Failed to record rejection.')} className="h-8 border-red-500/40 text-red-300"><XCircle className="h-3.5 w-3.5 mr-1" />Reject here</Button></>}
                    {stage.state === 'completed' && !terminal && !current && <Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'rejected', completed_at: new Date().toISOString() }, 'Failed to record rejection.')} className="h-8 border-red-500/40 text-red-300"><XCircle className="h-3.5 w-3.5 mr-1" />Rejected after this stage</Button>}
                  </div>
                </div></div>
              </div>
            })}</div>}

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3"><div className="font-medium flex items-center gap-2"><Plus className="h-4 w-4 text-blue-400" />Add stage</div><div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end"><div className="space-y-1.5"><Label>Template</Label><Select value={preset} onValueChange={setPreset}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700">{PRESETS.map((p) => <SelectItem key={p[0]} value={p[0]}>{p[1]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Custom name</Label><Input value={customName} onChange={(e) => setCustomName(e.target.value)} disabled={preset !== 'custom'} maxLength={200} placeholder="e.g. VP Engineering Interview" className="bg-slate-900 border-slate-700" /></div><Button disabled={busy === 'add' || (preset === 'custom' && !customName.trim())} onClick={() => void addStage()} className="bg-blue-600"><Plus className="h-4 w-4 mr-1" />Add</Button></div></div>
          </section>

          <section className="space-y-3"><div><h3 className="font-semibold">Lifecycle history</h3><p className="text-xs text-slate-500">Event snapshots preserve how the application progressed and where it ended.</p></div>{events.length === 0 ? <div className="text-sm text-slate-500">No lifecycle events yet.</div> : <div className="space-y-2">{events.map((event) => <div key={event.id} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2.5"><Clock3 className="h-4 w-4 mt-0.5 text-slate-500" /><div><div className="text-sm">{EVENT_LABEL[event.event_type] ?? event.event_type.replaceAll('_', ' ')}{event.stage_name_snapshot && <b> · {event.stage_name_snapshot}</b>}</div>{event.from_status && event.to_status && <div className="text-xs text-slate-500">{event.from_status} → {event.to_status}</div>}{event.notes && <div className="text-xs text-slate-500">{event.notes}</div>}<div className="text-[11px] text-slate-600">{fmt(event.occurred_at)}</div></div></div>)}</div>}</section>
        </div>}
      </DialogContent>
    </Dialog>
  )
}