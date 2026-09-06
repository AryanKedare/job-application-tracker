'use client'

import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
}

export default function MonthlyAnalysisToggle({ userId }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let active = true

    const load = async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user || user.id !== userId) throw error ?? new Error('User session is unavailable.')
        if (active) setEnabled(user.user_metadata?.monthly_analysis_enabled === true)
      } catch (error) {
        console.error('Monthly analysis preference load failed:', error)
        if (active) setErrorMessage('Could not load monthly analysis preference.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [userId])

  const changePreference = async (nextValue: boolean) => {
    const previousValue = enabled
    setEnabled(nextValue)
    setSaving(true)
    setErrorMessage(null)

    try {
      const { data: { user }, error: getError } = await supabase.auth.getUser()
      if (getError || !user || user.id !== userId) throw getError ?? new Error('User session is unavailable.')

      const { error } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          monthly_analysis_enabled: nextValue,
          monthly_analysis_changed_at: new Date().toISOString(),
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Monthly analysis preference save failed:', error)
      setEnabled(previousValue)
      setErrorMessage('Could not save monthly analysis preference.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-700/50 pt-3">
        <p className="text-sm font-medium text-slate-200">Monthly analysis email</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Monthly application analysis email"
          disabled={loading || saving}
          onClick={() => void changePreference(!enabled)}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ease-out disabled:cursor-not-allowed ${enabled ? 'bg-violet-500' : 'bg-slate-600'}`}
        >
          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      {errorMessage && <p role="alert" className="mt-2 text-xs text-red-400">{errorMessage}</p>}
    </>
  )
}
