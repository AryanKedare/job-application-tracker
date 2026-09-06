import Link from 'next/link'
import { CheckCircle2, MailX } from 'lucide-react'

import { Button } from '@/components/ui/button'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata = {
  title: 'Email preferences | Job Application Tracker',
  description: 'Manage Job Application Tracker product update emails.',
}

export default async function EmailUnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams
  const tokenValue = params.token
  const statusValue = params.status
  const token = typeof tokenValue === 'string' ? tokenValue : ''
  const status = typeof statusValue === 'string' ? statusValue : ''

  if (status === 'success') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-slate-900 p-6 text-center shadow-2xl sm:p-8">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-bold">Product updates turned off</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            You will no longer receive Job Application Tracker product updates or changelog emails. Account, authentication, and security emails are unaffected.
          </p>
          <Button asChild className="mt-6 bg-emerald-600 hover:bg-emerald-500">
            <Link href="/">Open Job Tracker</Link>
          </Button>
        </div>
      </main>
    )
  }

  const invalid = !token || status === 'invalid' || status === 'error'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2.5"><MailX className="h-5 w-5 text-violet-300" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Email preferences</p>
            <h1 className="text-xl font-bold">Unsubscribe from product updates</h1>
          </div>
        </div>

        {invalid ? (
          <>
            <p className="mt-5 text-sm leading-6 text-slate-400">
              This unsubscribe link is invalid or could not be processed. Sign in to Job Tracker and change the preference from Account settings instead.
            </p>
            <Button asChild variant="outline" className="mt-6 w-full border-slate-700">
              <Link href="/">Open Job Tracker</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-5 text-sm leading-6 text-slate-400">
              Confirm below to stop receiving product updates and changelog emails. Password recovery, magic links, and important account/security messages are not affected.
            </p>
            <form action="/api/email-preferences/unsubscribe" method="post" className="mt-6 space-y-3">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500">Confirm unsubscribe</Button>
              <Button asChild type="button" variant="outline" className="w-full border-slate-700">
                <Link href="/">Keep product updates</Link>
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
