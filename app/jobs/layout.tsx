import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Applications',
  description: 'Manage job applications, interview stages, resumes, notes, and application outcomes.',
}

export default function JobsLayout({ children }: { children: ReactNode }) {
  return children
}
