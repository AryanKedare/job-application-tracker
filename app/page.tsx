'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, FileText, Briefcase, TrendingUp, Trophy, XCircle, Ghost, Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { JobApplication } from '@/lib/types'

const STATUS_CONFIG: {
  key: JobApplication['status']
  label: string
  icon: React.ReactNode
  color: string
  bg: string
}[] = [
  { key: 'Applied',      label: 'Applied',      icon: <Briefcase className="w-4 h-4" />,   color: 'text-blue-300',    bg: 'bg-blue-500/15 border-blue-500/30' },
  { key: 'Interviewing', label: 'Interviewing', icon: <TrendingUp className="w-4 h-4" />,  color: 'text-yellow-300',  bg: 'bg-yellow-500/15 border-yellow-500/30' },
  { key: 'Offer',        label: 'Offer',        icon: <Trophy className="w-4 h-4" />,      color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  { key: 'Rejected',     label: 'Rejected',     icon: <XCircle className="w-4 h-4" />,    color: 'text-red-300',     bg: 'bg-red-500/15 border-red-500/30' },
  { key: 'Ghosted',      label: 'Ghosted',      icon: <Ghost className="w-4 h-4" />,      color: 'text-slate-400',   bg: 'bg-slate-700/40 border-slate-600/30' },
  { key: 'Bookmarked',   label: 'Saved',        icon: <Bookmark className="w-4 h-4" />,   color: 'text-slate-300',   bg: 'bg-slate-800/60 border-slate-700/40' },
]

export default function Home() {
  const [stats, setStats] = useState<Partial<Record<JobApplication['status'], number>>>({})
  const [total, setTotal] = useState<number | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const loadStats = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setLoggedIn(true)

      const { data } = await supabase
        .from('job_applications')
        .select('status')
        .eq('user_id', user.id)

      if (!data) return
      setTotal(data.length)
      const counts: Partial<Record<JobApplication['status'], number>> = {}
      for (const row of data) {
        counts[row.status as JobApplication['status']] = (counts[row.status as JobApplication['status']] ?? 0) + 1
      }
      setStats(counts)
    }
    loadStats()
  }, [])

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-7xl font-black bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-400 bg-clip-text text-transparent mb-6">
            Job Tracker
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Track job applications, resumes, and notes in one clean place.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

          {/* View applications card */}
          <Link href="/jobs" className="group">
            <div className="group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 bg-slate-900/70 rounded-3xl p-10 shadow-2xl border border-slate-800 hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 h-full flex flex-col">
              <FileText className="w-16 h-16 mx-auto mb-6 text-blue-400 group-hover:text-white transition-colors" />
              <h3 className="text-2xl font-bold mb-4 group-hover:text-white">View applications</h3>
              <p className="text-lg text-slate-300 group-hover:text-slate-100 mb-8 flex-1">
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

          {/* Stats card */}
          <div className="bg-slate-900/70 rounded-3xl p-8 shadow-2xl border border-slate-800 h-full flex flex-col text-left">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-100">Your Progress</h3>
              {total !== null && (
                <span className="text-sm font-semibold text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                  {total} total
                </span>
              )}
            </div>

            {!loggedIn ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                <p className="text-slate-400 text-sm mb-4">Sign in to see your stats</p>
                <Link href="/login">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                    Sign in
                  </Button>
                </Link>
              </div>
            ) : total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                <p className="text-slate-400 text-sm">No applications yet.</p>
                <p className="text-slate-500 text-xs mt-1">Add your first one to see stats here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 flex-1 content-start">
                {STATUS_CONFIG.map(({ key, label, icon, color, bg }) => {
                  const count = stats[key] ?? 0
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${bg}`}
                    >
                      <span className={color}>{icon}</span>
                      <div>
                        <div className={`text-xl font-bold leading-none ${color}`}>{count}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
