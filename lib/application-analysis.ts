import type { ApplicationStageState, ApplicationStatus } from '@/lib/types'

export interface AnalysisJob {
  id: string
  job_title: string
  company: string | null
  status: ApplicationStatus
  date_applied: string | null
  location: string | null
  source: string | null
  rejected_stage_name: string | null
  created_at: string | null
}

export interface AnalysisStage {
  application_id: string
  name: string
  stage_type: string
  position: number
  state: ApplicationStageState
  started_at: string | null
  completed_at: string | null
  updated_at: string | null
}

export interface SourcePerformance {
  source: string
  total: number
  interviewActivity: number
  offers: number
}

export interface MonthlyActivity {
  month: string
  applications: number
}

export interface ApplicationAnalysisSnapshot {
  totalApplications: number
  trackedApplications: number
  activeApplications: number
  interviewActivity: number
  offers: number
  staleApplications: number
  applicationsLast30Days: number
  interviewActivityRate: number
  offerFromInterviewRate: number
  statusCounts: Record<ApplicationStatus, number>
  sourcePerformance: SourcePerformance[]
  rejectionStages: Array<{ stage: string; count: number }>
  monthlyActivity: MonthlyActivity[]
  recentApplications: Array<{
    title: string
    company: string
    status: ApplicationStatus
    appliedAt: string | null
    location: string | null
    source: string | null
    daysSinceActivity: number | null
    stages: Array<{ name: string; state: ApplicationStageState }>
  }>
}

const STATUSES: ApplicationStatus[] = ['Bookmarked', 'Applied', 'Interviewing', 'Offer', 'Rejected', 'Ghosted']
const DAY_MS = 24 * 60 * 60 * 1000

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function daysBetween(now: Date, then: Date | null) {
  if (!then) return null
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MS))
}

function latestDate(values: Array<string | null | undefined>) {
  let latest: Date | null = null
  for (const value of values) {
    const date = parseDate(value)
    if (date && (!latest || date.getTime() > latest.getTime())) latest = date
  }
  return latest
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function recentMonthKeys(now: Date, count: number) {
  const keys: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    keys.push(monthKey(date))
  }
  return keys
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

export function buildApplicationAnalysisSnapshot(
  jobs: AnalysisJob[],
  stages: AnalysisStage[],
  now = new Date(),
): ApplicationAnalysisSnapshot {
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<ApplicationStatus, number>
  const stagesByApplication = new Map<string, AnalysisStage[]>()

  for (const stage of stages) {
    const list = stagesByApplication.get(stage.application_id) ?? []
    list.push(stage)
    stagesByApplication.set(stage.application_id, list)
  }

  const interviewApplicationIds = new Set<string>()
  const sourceStats = new Map<string, SourcePerformance>()
  const rejectionStageCounts = new Map<string, number>()
  const monthCounts = new Map(recentMonthKeys(now, 6).map((key) => [key, 0]))
  let staleApplications = 0
  let applicationsLast30Days = 0

  const prepared = jobs.map((job) => {
    statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1

    const jobStages = (stagesByApplication.get(job.id) ?? [])
      .sort((a, b) => a.position - b.position)

    const hasInterviewActivity = job.status === 'Interviewing' || job.status === 'Offer' || jobStages.some((stage) =>
      stage.position > 0
      && stage.stage_type !== 'application'
      && !['pending', 'skipped'].includes(stage.state),
    )
    if (hasInterviewActivity) interviewApplicationIds.add(job.id)

    const lastActivity = latestDate([
      job.date_applied,
      job.created_at,
      ...jobStages.flatMap((stage) => [stage.started_at, stage.completed_at, stage.updated_at]),
    ])
    const daysSinceActivity = daysBetween(now, lastActivity)

    if (
      (job.status === 'Applied' && daysSinceActivity !== null && daysSinceActivity >= 21)
      || (job.status === 'Interviewing' && daysSinceActivity !== null && daysSinceActivity >= 14)
    ) {
      staleApplications += 1
    }

    const appliedDate = parseDate(job.date_applied) ?? parseDate(job.created_at)
    if (appliedDate && now.getTime() - appliedDate.getTime() <= 30 * DAY_MS) applicationsLast30Days += 1
    if (appliedDate) {
      const key = monthKey(appliedDate)
      if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
    }

    const source = job.source?.trim() || 'Unknown'
    const sourceRow = sourceStats.get(source) ?? { source, total: 0, interviewActivity: 0, offers: 0 }
    sourceRow.total += 1
    if (hasInterviewActivity) sourceRow.interviewActivity += 1
    if (job.status === 'Offer') sourceRow.offers += 1
    sourceStats.set(source, sourceRow)

    const rejectedStage = job.rejected_stage_name?.trim()
      || jobStages.find((stage) => stage.state === 'rejected')?.name?.trim()
    if (job.status === 'Rejected' && rejectedStage) {
      rejectionStageCounts.set(rejectedStage, (rejectionStageCounts.get(rejectedStage) ?? 0) + 1)
    }

    return {
      title: job.job_title || 'Untitled role',
      company: job.company?.trim() || 'Unknown company',
      status: job.status,
      appliedAt: job.date_applied,
      location: job.location?.trim() || null,
      source: job.source?.trim() || null,
      daysSinceActivity,
      stages: jobStages.map((stage) => ({ name: stage.name, state: stage.state })),
      sortDate: appliedDate?.getTime() ?? 0,
    }
  })

  const trackedApplications = jobs.filter((job) => job.status !== 'Bookmarked').length
  const activeApplications = statusCounts.Applied + statusCounts.Interviewing
  const interviewActivity = interviewApplicationIds.size
  const offers = statusCounts.Offer

  return {
    totalApplications: jobs.length,
    trackedApplications,
    activeApplications,
    interviewActivity,
    offers,
    staleApplications,
    applicationsLast30Days,
    interviewActivityRate: percent(interviewActivity, trackedApplications),
    offerFromInterviewRate: percent(offers, interviewActivity),
    statusCounts,
    sourcePerformance: [...sourceStats.values()]
      .sort((a, b) => b.total - a.total || b.interviewActivity - a.interviewActivity)
      .slice(0, 8),
    rejectionStages: [...rejectionStageCounts.entries()]
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    monthlyActivity: [...monthCounts.entries()].map(([month, applications]) => ({ month, applications })),
    recentApplications: prepared
      .sort((a, b) => b.sortDate - a.sortDate)
      .slice(0, 100)
      .map(({ sortDate: _sortDate, ...application }) => application),
  }
}
