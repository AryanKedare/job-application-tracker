import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Plus, FileText } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-12">
          <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-400 bg-clip-text text-transparent mb-6">
            Job Tracker
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Track job applications, resumes, and job descriptions in one clean place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Link href="/jobs" className="group">
            <div className="group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 bg-slate-900/70 rounded-3xl p-10 shadow-2xl border border-slate-800 hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
              <FileText className="w-16 h-16 mx-auto mb-6 text-blue-400 group-hover:text-white transition-colors" />
              <h3 className="text-2xl font-bold mb-4 group-hover:text-white">View applications</h3>
              <p className="text-lg text-slate-300 group-hover:text-slate-100 mb-8">
                See every application, status, and resume in one table.
              </p>
              <Button
                size="lg"
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 group-hover:bg-white/20 border border-blue-300/40"
              >
                Open dashboard
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </Link>

          <div className="group">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
              <Plus className="w-16 h-16 mx-auto mb-6 opacity-90" />
              <h3 className="text-2xl font-bold mb-4 text-white">Quick add</h3>
              <p className="text-lg mb-8 text-white/90">
                Add new applications with resume upload in seconds.
              </p>
              <Link href="/jobs">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full h-14 bg-white/20 hover:bg-white/30 border border-white/40"
                >
                  Go to table
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
