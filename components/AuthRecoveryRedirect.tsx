'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function isRecoveryLocation(): boolean {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const type = url.searchParams.get('type') ?? hash.get('type')

  return type === 'recovery' || type === 'invite' || url.pathname === '/auth/recovery'
}

export default function AuthRecoveryRedirect() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname === '/reset-password') return

    let cancelled = false

    const goToReset = () => {
      if (cancelled || window.location.pathname === '/reset-password') return
      router.replace('/reset-password')
      router.refresh()
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') goToReset()
    })

    const handleCurrentUrl = async () => {
      if (!isRecoveryLocation()) return

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
        if (!error) goToReset()
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) goToReset()
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) goToReset()
    }

    void handleCurrentUrl()

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  return null
}
