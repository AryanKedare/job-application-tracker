// app/jobs/layout.tsx
import type { ReactNode } from 'react'

export default function JobsLayout({ children }: { children: ReactNode }) {
  // No server-side auth here; handled on client in /jobs/page.tsx
  return <>{children}</>
}
