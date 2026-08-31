import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthRecoveryRedirect from '@/components/AuthRecoveryRedirect'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  applicationName: 'Job Tracker',
  title: {
    default: 'Job Tracker',
    template: '%s | Job Tracker',
  },
  description: 'A private, invitation-only workspace for tracking job applications, interview stages, resumes, notes, and outcomes.',
  category: 'productivity',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: '#020617',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-screen overflow-x-hidden bg-slate-950 antialiased ${inter.className}`}>
        <AuthRecoveryRedirect />
        {children}
      </body>
    </html>
  )
}
