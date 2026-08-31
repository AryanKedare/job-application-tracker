import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your invitation-only Job Tracker account, redeem an invite code, or request access.',
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
