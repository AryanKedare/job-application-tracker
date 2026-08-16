import type { Metadata } from 'next'
import { Construction, ShieldCheck, Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Maintenance | Job Tracker',
  description: 'Job Tracker is temporarily unavailable while improvements are being made.',
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center py-12">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/75 p-8 text-center shadow-2xl backdrop-blur sm:p-12">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10">
            <Construction className="h-8 w-8 text-blue-300" />
          </div>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Maintenance in progress
          </div>

          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            We&apos;re improving Job Tracker
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            We&apos;re currently working on upgrades and improvements. The application will be available again as soon as the work is complete.
          </p>

          <div className="mx-auto mt-8 flex max-w-md items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-left">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">Your application data is preserved</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                This maintenance window only affects access to the app while improvements are being deployed.
              </p>
            </div>
          </div>

          <p className="mt-8 text-xs text-slate-600">Thank you for your patience.</p>
        </section>
      </div>
    </main>
  )
}
