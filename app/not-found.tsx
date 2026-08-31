import Link from 'next/link'
import { ArrowLeft, FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 text-center">
        <FileQuestion className="mx-auto h-12 w-12 text-slate-500" />
        <p className="mt-5 text-sm font-semibold text-blue-300">404</p>
        <h1 className="mt-1 text-3xl font-black">Page not found</h1>
        <p className="mt-3 text-sm text-slate-400">The page you requested does not exist or is no longer available.</p>
        <Link href="/" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
          <ArrowLeft className="h-4 w-4" />
          Back to Job Tracker
        </Link>
      </section>
    </main>
  )
}
