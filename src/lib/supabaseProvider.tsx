// src/lib/supabaseProvider.tsx
'use client'

import { createContext, useContext, useState } from 'react'
import { createSupabaseBrowserClient } from './supabaseClient'
import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseContextValue = {
  supabase: SupabaseClient
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined
)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createSupabaseBrowserClient())
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext)
  if (!ctx) throw new Error('useSupabase must be used inside SupabaseProvider')
  return ctx.supabase
}
