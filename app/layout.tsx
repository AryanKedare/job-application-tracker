// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { SupabaseProvider } from '@/lib/supabaseProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Job Tracker',
  description: 'Track your job applications beautifully',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={cn(
          'min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 antialiased',
          inter.className
        )}
      >
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}
