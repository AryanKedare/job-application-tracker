'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Circle, ListTree, Pencil, Play, Plus, Save, SkipForward, Trash2, X, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ApplicationStage, JobApplication } from '@/lib/types'
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
  onSuccess?: (message: string) => void
}

interface EditForm {
  name: string
  stage_type: string
  state: ApplicationStage['state']
  started_at: string
  completed_at: string
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
  ['custom', 'Custom stage', 'custom'],
] as const

const stateTone: Record<ApplicationStage['state'], string> = {
  pending: 'text-slate-400 border-slate-700',
  current: 'text-yellow-300 border-yellow-500/40',
  completed: 'text-emerald-300 border-emerald-500/40',
  skipped: 'text-slate-500 border-slate-700',
  rejected: 'text-red-300 border-red-500/40',
}

const EMPTY_EDIT_FORM: EditForm = { name: '', stage_type: 'custom', state: 'pending', started_at: '', completed_at: '' }

function fmt(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toLocalDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIso(value: string) { return value ? new Date(value).toISOString() : null }
function isProgressed(state: ApplicationStage['state']) { return state !== 'pending' }

export default function ApplicationLifecycleDialog({ open, setOpen, job, userId, onChanged, onError, onSuccess }: Props) {
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [preset, setPreset] = useState('recruiter-screening')
  const [customName, setCustomName] = useState('')
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setSchemaMissing(false)
    const { data, error } = await supabase
      .from('application_stages')
      .select('*')
      .eq('application_id', job.id)
      .eq('user_id', userId)
      .order('position')
      .order('created_at')

    if (error) {
      setSchemaMissing(error.code === '42P01' || error.code === 'PGRST205')
      if (error.code !== '42P01' && error.code !== 'PGRST205') onError('Failed to load the application lifecycle.')
    } else {
      setStages((data ?? []) as ApplicationStage[])
    }
    setLoading(false)
  }, [job.id, onError, open, userId])

  useEffect(() => { void load() }, [load])

  const orderedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? '')), [stages])
  const current = useMemo(() => stages.find((stage) => stage.state === 'current') ?? null, [stages])
  const rejected = useMemo(() => stages.filter((stage) => stage.state === 'rejected').sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime())[0] ?? null, [stages])
  const terminal = job.status === 'Offer' || job.status === 'Rejected' || job.status === 'Ghosted'

  const refresh = async () => { await load(); await onChanged() }

  const addStage = async () => {
    const choice = PRESETS.find((item) => item[0] === preset) ?? PRESETS[0]
    const name = choice[0] === 'custom' ? customName.trim() : choice[1]
    if (!name) return onError('Enter a name for the custom stage.')

    setBusy('add')
    const position = stages.length ? Math.max(...stages.map((stage) => stage.position)) + 1 : 0
    const { error } = await supabase.from('application_stages').insert({ application_id: job.id, user_id: userId, name, stage_type: choice[2], position, state: 'pending' })
    setBusy(null)
    if (error) return onError('Failed to add the application stage.')
    setCustomName('')
    await refresh()
    onSuccess?.(`Added ${name}.`)
  }

  const updateStage = async (stage: ApplicationStage, values: Partial<ApplicationStage>, errorMessage: string, successMessage: string) => {
    setBusy(stage.id)
    const { error } = await supabase.from('application_stages').update(values).eq('id', stage.id).eq('user_id', userId)
    setBusy(null)
    if (error) return onError(errorMessage)
    await refresh()
    onSuccess?.(successMessage)
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
      onSuccess?.(`Started ${stage.name}.`)
    } catch {
      onError('Failed to start this stage.')
      await load()
    } finally {
      setBusy(null)
    }
  }

  const move = async (stage: ApplicationStage, direction: -1 | 1) => {
    const index = orderedStages.findIndex((item) => item.id === stage.id)
    const other = orderedStages[index + direction]
    if (!other) return

    setBusy(stage.id)
    const first = await supabase.from('application_stages').update({ position: other.position }).eq('id', stage.id).eq('user_id', userId)
    const second = first.error ? first : await supabase.from('application_stages').update({ position: stage.position }).eq('id', other.id).eq('user_id', userId)
    setBusy(null)
    if (first.error || second.error) return onError('Failed to reorder stages.')
    await refresh()
    onSuccess?.('Stage order updated.')
  }

  const beginEdit = (stage: ApplicationStage) => {
    setEditingId(stage.id)
    setEditForm({ name: stage.name, stage_type: stage.stage_type, state: stage.state, started_at: toLocalDateTime(stage.started_at), completed_at: toLocalDateTime(stage.completed_at) })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(EMPTY_EDIT_FORM) }

  const saveEdit = async (stage: ApplicationStage) => {
    const name = editForm.name.trim()
    const stageType = editForm.stage_type.trim()
    if (!name) return onError('Stage name cannot be empty.')
    if (!stageType) return onError('Stage type cannot be empty.')

    const anotherCurrent = stages.find((item) => item.id !== stage.id && item.state === 'current')
    if (editForm.state === 'current' && anotherCurrent) return onError(`"${anotherCurrent.name}" is already the current stage.`)

    let startedAt = toIso(editForm.started_at)
    let completedAt = toIso(editForm.completed_at)
    if (editForm.state === 'pending') { startedAt = null; completedAt = null }
    else if (editForm.state === 'current') { startedAt = startedAt ?? stage.started_at ?? new Date().toISOString(); completedAt = null }
    else { completedAt = completedAt ?? stage.completed_at ?? new Date().toISOString() }

    if (startedAt && completedAt && new Date(completedAt).getTime() < new Date(startedAt).getTime()) return onError('Completed time cannot be before the started time.')

    setBusy(stage.id)
    const values: Partial<ApplicationStage> = { name, stage_type: stageType, state: editForm.state, started_at: startedAt, completed_at: completedAt }
    const { error } = await supabase.from('application_stages').update(values).eq('id', stage.id).eq('user_id', userId)
    if (error) { setBusy(null); return onError('Failed to save stage changes.') }

    const corrected = stages.map((item) => item.id === stage.id ? ({ ...item, ...values } as ApplicationStage) : item)
    if (editForm.state === 'rejected') {
      await supabase.from('job_applications').update({ status: 'Rejected', rejected_stage_name: name, rejected_at: completedAt ?? new Date().toISOString() }).eq('id', job.id).eq('user_id', userId)
    } else if (job.status === 'Rejected' && stage.state === 'rejected') {
      const otherRejected = corrected.find((item) => item.state === 'rejected')
      if (otherRejected) {
        await supabase.from('job_applications').update({ rejected_stage_name: otherRejected.name, rejected_at: otherRejected.completed_at ?? new Date().toISOString() }).eq('id', job.id).eq('user_id', userId)
      } else {
        await supabase.from('job_applications').update({ status: corrected.some((item) => isProgressed(item.state)) ? 'Interviewing' : 'Applied', rejected_stage_name: null, rejected_at: null }).eq('id', job.id).eq('user_id', userId)
      }
    }

    setBusy(null)
    cancelEdit()
    await refresh()
    onSuccess?.('Stage updated.')
  }

  const remove = async (stage: ApplicationStage) => {
    setBusy(stage.id)
    const { error } = await supabase.from('application_stages').delete().eq('id', stage.id).eq('user_id', userId)
    if (error) { setBusy(null); return onError('Failed to delete this stage.') }

    const remaining = stages.filter((item) => item.id !== stage.id)
    if (stage.state === 'rejected' && job.status === 'Rejected') {
      const otherRejected = remaining.find((item) => item.state === 'rejected')
      if (otherRejected) {
        await supabase.from('job_applications').update({ rejected_stage_name: otherRejected.name, rejected_at: otherRejected.completed_at ?? new Date().toISOString() }).eq('id', job.id).eq('user_id', userId)
      } else {
        await supabase.from('job_applications').update({ status: remaining.some((item) => isProgressed(item.state)) ? 'Interviewing' : 'Applied', rejected_stage_name: null, rejected_at: null }).eq('id', job.id).eq('user_id', userId)
      }
    } else if (stage.state === 'current' && job.status === 'Interviewing' && !remaining.some((item) => isProgressed(item.state))) {
      await supabase.from('job_applications').update({ status: 'Applied' }).eq('id', job.id).eq('user_id', userId)
    }

    setBusy(null)
    if (editingId === stage.id) cancelEdit()
    await refresh()
    onSuccess?.(`Deleted ${stage.name}.`)
  }

  const lastLabel = (job.status === 'Rejected' ? rejected?.name : null) ?? current?.name ?? orderedStages.filter((stage) => stage.state === 'completed').at(-1)?.name ?? null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-x-hidden overflow-y-auto border-slate-700 bg-slate-900 p-4 text-slate-100 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-2"><ListTree className="h-5 w-5 flex-shrink-0 text-blue-400" /><span className="break-words">{job.job_title}</span></DialogTitle>
          <p className="break-words text-sm text-slate-400">{job.company || 'Company not set'} · {job.status}</p>
        </DialogHeader>

        {schemaMissing ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Stage tracking is not configured in the database.</div>
        ) : loading ? (
          <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" /></div>
        ) : (
          <div className="space-y-6">
            {orderedStages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-xs uppercase text-slate-500">Status</div><div className="mt-1 font-semibold">{job.status}</div></div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:col-span-2"><div className="text-xs uppercase text-slate-500">Current / last stage</div><div className="mt-1 break-words font-semibold">{lastLabel}</div></div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 px-5 py-10 text-center">
                <ListTree className="mx-auto h-10 w-10 text-slate-600" />
                <h3 className="mt-4 text-lg font-semibold text-slate-200">No interview stages</h3>
              </div>
            )}

            {orderedStages.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-semibold">Application lifecycle</h3>
                <div className="space-y-2">
                  {orderedStages.map((stage, index) => (
                    <div key={stage.id} className={`rounded-xl border p-4 ${stateTone[stage.state]}`}>
                      <div className="flex gap-3">
                        <Circle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><span className="break-words font-semibold text-slate-100">{stage.name}</span><span className="rounded-full border px-2 py-0.5 text-[10px] uppercase">{stage.state}</span><span className="text-xs text-slate-600">#{index + 1}</span></div>
                          {(stage.started_at || stage.completed_at) && <div className="mt-1 text-xs text-slate-500">{stage.started_at && <>Started {fmt(stage.started_at)}</>}{stage.started_at && stage.completed_at && ' · '}{stage.completed_at && <>Finished {fmt(stage.completed_at)}</>}</div>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {stage.state === 'pending' && <><Button size="sm" disabled={busy === stage.id || terminal} onClick={() => void start(stage)} className="h-8 bg-blue-600"><Play className="mr-1 h-3.5 w-3.5" />Start</Button><Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'skipped', completed_at: new Date().toISOString() }, 'Failed to skip stage.', `${stage.name} skipped.`)} className="h-8 border-slate-700"><SkipForward className="mr-1 h-3.5 w-3.5" />Skip</Button></>}
                            {stage.state === 'current' && <><Button size="sm" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'completed', completed_at: new Date().toISOString() }, 'Failed to complete stage.', `${stage.name} completed.`)} className="h-8 bg-emerald-600"><Check className="mr-1 h-3.5 w-3.5" />Complete</Button><Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'rejected', completed_at: new Date().toISOString() }, 'Failed to record rejection.', `Rejected at ${stage.name}.`)} className="h-8 border-red-500/40 text-red-300"><XCircle className="mr-1 h-3.5 w-3.5" />Reject here</Button></>}
                            {stage.state === 'completed' && !terminal && !current && <Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void updateStage(stage, { state: 'rejected', completed_at: new Date().toISOString() }, 'Failed to record rejection.', `Rejected after ${stage.name}.`)} className="h-8 border-red-500/40 text-red-300"><XCircle className="mr-1 h-3.5 w-3.5" />Reject after stage</Button>}
                            <Button size="icon" variant="outline" disabled={busy === stage.id || index === 0} onClick={() => void move(stage, -1)} className="h-8 w-8 border-slate-700" aria-label="Move stage up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="outline" disabled={busy === stage.id || index === orderedStages.length - 1} onClick={() => void move(stage, 1)} className="h-8 w-8 border-slate-700" aria-label="Move stage down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => beginEdit(stage)} className="h-8 border-slate-700"><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                            <Button size="sm" variant="outline" disabled={busy === stage.id} onClick={() => void remove(stage)} className="h-8 border-red-500/30 text-red-300"><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
                          </div>

                          {editingId === stage.id && (
                            <div className="mt-4 space-y-4 rounded-xl border border-blue-500/20 bg-slate-950/60 p-4 text-slate-100">
                              <div className="flex items-center justify-between gap-3"><div className="font-semibold">Edit stage</div><Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8" aria-label="Close stage editor"><X className="h-4 w-4" /></Button></div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5"><Label>Stage name</Label><Input value={editForm.name} maxLength={200} onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))} className="bg-slate-900 border-slate-700" /></div>
                                <div className="space-y-1.5"><Label>Stage type</Label><Input value={editForm.stage_type} maxLength={80} onChange={(event) => setEditForm((form) => ({ ...form, stage_type: event.target.value }))} className="bg-slate-900 border-slate-700" /></div>
                                <div className="space-y-1.5"><Label>State</Label><Select value={editForm.state} onValueChange={(value) => setEditForm((form) => ({ ...form, state: value as ApplicationStage['state'] }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700"><SelectItem value="pending">Pending</SelectItem><SelectItem value="current">Current</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="skipped">Skipped</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select></div>
                                <div />
                                <div className="space-y-1.5"><Label>Started at</Label><Input type="datetime-local" value={editForm.started_at} disabled={editForm.state === 'pending'} onChange={(event) => setEditForm((form) => ({ ...form, started_at: event.target.value }))} className="bg-slate-900 border-slate-700" /></div>
                                <div className="space-y-1.5"><Label>Completed at</Label><Input type="datetime-local" value={editForm.completed_at} disabled={editForm.state === 'pending' || editForm.state === 'current'} onChange={(event) => setEditForm((form) => ({ ...form, completed_at: event.target.value }))} className="bg-slate-900 border-slate-700" /></div>
                              </div>
                              <div className="flex flex-wrap justify-end gap-2"><Button size="sm" variant="outline" onClick={cancelEdit} className="border-slate-700">Cancel</Button><Button size="sm" disabled={busy === stage.id} onClick={() => void saveEdit(stage)} className="bg-blue-600"><Save className="mr-1 h-3.5 w-3.5" />Save changes</Button></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 font-medium"><Plus className="h-4 w-4 text-blue-400" />Add stage</div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5"><Label>Template</Label><Select value={preset} onValueChange={setPreset}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-slate-700">{PRESETS.map((item) => <SelectItem key={item[0]} value={item[0]}>{item[1]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Custom stage name</Label><Input value={customName} onChange={(event) => setCustomName(event.target.value)} disabled={preset !== 'custom'} maxLength={200} className="bg-slate-900 border-slate-700" /></div>
                <Button disabled={busy === 'add' || (preset === 'custom' && !customName.trim())} onClick={() => void addStage()} className="bg-blue-600"><Plus className="mr-1 h-4 w-4" />Add</Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
