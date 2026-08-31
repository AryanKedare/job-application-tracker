import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Maintenance',
  description: 'Job Tracker is temporarily unavailable while maintenance is in progress.',
}

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return children
}
