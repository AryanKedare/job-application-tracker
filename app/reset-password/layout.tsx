import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Choose a new password for your Job Tracker account.',
}

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children
}
