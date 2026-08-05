'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RecoveryLandingPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Preparing your password reset…')

  useEffect(() => {
    let cancelled = false

    const finish = () => {
      if (cancelled) return
      router.replace('/reset-password')
      router.refresh()
    }

    const processRecovery = async () => {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = url.searchParams.get('code')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) return finish()
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return finish()
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) return finish()

      if (!cancelled) {
        setMessage('This recovery link is invalid or has expired. Request a new password reset email.')
      }
    }

    void processRecovery()
    return () => { cancelled = true }
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
        <p className="text-sm text-slate-300">{message}</p>
      </div>
    </main>
  )
}
