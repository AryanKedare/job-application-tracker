# Job Application Tracker

A full-stack job application tracker built with **Next.js 16**, **Supabase**, and **Tailwind CSS v4**.

## Features

- 🔐 Passwordless magic link authentication via Supabase
- ➕ Add, edit, delete job applications
- 🎯 Status tracking: Bookmarked → Applied → Interviewing → Offer / Rejected / Ghosted
- 📎 Resume URL attachment per application
- 📝 Notes per application
- 🔒 Row-Level Security enforced both at DB and client level

## Setup

### 1. Clone and install

```bash
git clone https://github.com/AryanKedare/job-application-tracker.git
cd job-application-tracker
npm install
```

### 2. Environment variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Supabase table + RLS

Run this SQL in your Supabase SQL editor:

```sql
create table job_applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  job_title    text not null,
  company      text,
  job_link     text,
  status       text default 'Bookmarked',
  date_applied date,
  location     text,
  source       text,
  resume_url   text,
  notes        text,
  created_at   timestamptz default now()
);

-- Enable Row Level Security
alter table job_applications enable row level security;

-- Policy: users can only read/write their own rows
create policy "Users manage their own applications"
  on job_applications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database / Auth | Supabase |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI (shadcn/ui) |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |

## Deployment

Deploy to [Vercel](https://vercel.com) — connect your repo and add the three env vars above in the Vercel project settings.
