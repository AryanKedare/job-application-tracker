import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Admin sign in',
  description: 'Sign in to the Job Tracker administration portal.',
}

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children
}
