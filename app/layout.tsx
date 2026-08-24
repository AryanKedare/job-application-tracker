// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { SupabaseProvider } from '@/lib/supabaseProvider'
import AuthRecoveryRedirect from '@/components/AuthRecoveryRedirect'

export const metadata: Metadata = {
  title: 'Job Tracker',
  description: 'Track your applications, interviews, resumes and outcomes in one place.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="app-shell antialiased">
        <SupabaseProvider>
          <AuthRecoveryRedirect />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}
