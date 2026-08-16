// lib/types.ts
export type ApplicationStatus = 'Bookmarked' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Ghosted'
export type ApplicationStageState = 'pending' | 'current' | 'completed' | 'skipped' | 'rejected'

export interface JobApplication {
  id: string
  user_id: string
  job_title: string
  company: string
  job_link: string
  status: ApplicationStatus
  date_applied: string
  location?: string
  source?: string
  resume_url?: string
  jd_text?: string
  notes?: string
  rejected_at?: string | null
  rejected_stage_name?: string | null
  created_at?: string
}

export interface ApplicationStage {
  id: string
  application_id: string
  user_id: string
  name: string
  stage_type: string
  position: number
  state: ApplicationStageState
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}
