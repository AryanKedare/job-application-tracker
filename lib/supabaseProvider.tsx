'use client'
import { createContext, useContext, ReactNode } from 'react'

const SupabaseContext = createContext<null>(null)

export function SupabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseContext.Provider value={null}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabase() {
  return useContext(SupabaseContext)
}
