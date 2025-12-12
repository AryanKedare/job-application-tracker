export interface JobApplication {
  id: string
  job_title: string
  company: string
  job_link: string
  status: 'Bookmarked' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected' | 'Ghosted'
  date_applied: string
  location?: string
  source?: string
  resume_url?: string
  jd_text?: string
  notes?: string
  created_at: string
}
