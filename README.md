# Job Application Tracker

A full-stack job application tracker built with **Next.js 16**, **Supabase**, and **Tailwind CSS v4**. Track every application, its status, resume, and notes — all in one clean dashboard.

**Live:** [job-application-tracker](https://github.com/AryanKedare/job-application-tracker) &nbsp;|&nbsp; **Source:** [github.com/AryanKedare/job-application-tracker](https://github.com/AryanKedare/job-application-tracker)

---

## Features

- 🔐 **Passwordless auth** — magic link sign-in via Supabase
- ➕ **Add, edit, delete** applications with a clean modal form
- 🎯 **6-stage status tracking** — Bookmarked → Applied → Interviewing → Offer / Rejected / Ghosted
- 🏢 **Company logos** — auto-fetched from Hunter.io and Google Favicons with a graceful initials fallback
- 📎 **Resume URL** — attach a CV link per application
- 📝 **Notes** — per-application freeform notes with a modal viewer
- 🔍 **Search + filter** — search by role, company, or location; filter by status
- 📊 **Stats strip** — live counts for Applied, Interviewing, and Offers
- 🏠 **Homepage dashboard** — personal progress overview with per-status counts
- 👤 **Inline name editing** — set or update display name from the homepage
- 🗑️ **Account settings** — delete all data or manage account from the dashboard
- 🔒 **Row-Level Security** — enforced at both Supabase DB and client query level
- ✅ **Confirmation dialogs** — safe delete flow using a Radix UI dialog (no `confirm()`)
- 🔔 **Toast notifications** — success/error feedback for all actions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, `'use client'`) |
| Database & Auth | Supabase (PostgreSQL + magic link auth) |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI via shadcn/ui |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Deployment | Vercel |

---

## Getting Started

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

Get these from your [Supabase project settings → API](https://supabase.com/dashboard).

### 3. Supabase table + RLS

Run this SQL in your **Supabase SQL Editor**:

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

### 4. Configure Supabase Auth redirect URL

In your Supabase project → **Authentication → URL Configuration**, add:

```
http://localhost:3000/auth/callback
```

And for production add your Vercel URL (e.g. `https://your-app.vercel.app/auth/callback`).

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
job-application-tracker/
├── app/
│   ├── page.tsx              # Homepage — hero, stats, GitHub link footer
│   ├── jobs/
│   │   └── page.tsx          # Main dashboard — table, search, filter, CRUD
│   ├── login/
│   │   └── page.tsx          # Magic link sign-in page
│   └── auth/
│       └── callback/
│           └── route.ts      # Supabase auth callback handler
├── components/
│   ├── AddJobDialog.tsx       # Add / edit application modal (React Hook Form + Zod)
│   ├── DeleteConfirmDialog.tsx# Radix UI confirmation dialog for deletions
│   ├── AccountSettingsDialog.tsx # Account management + data deletion
│   ├── Toast.tsx              # Success / error toast notification
│   └── ui/                   # shadcn/ui primitives (Button, Input, Dialog, …)
├── lib/
│   ├── supabase.ts            # Supabase client initialisation
│   └── types.ts               # JobApplication TypeScript type + status union
└── README.md
```

---

## Company Logo Resolution

The dashboard auto-resolves company logos for each job row:

1. Extracts the root domain from `job_link` (strips `www`, `jobs`, `careers`, etc.)
2. Tries `logos.hunter.io/{domain}` first (higher quality)
3. Falls back to `google.com/s2/favicons?domain={domain}&sz=64`
4. If both fail, renders a coloured initials avatar derived from the company name

All avatars render in a **white-background rounded container** (`w-10 h-10 rounded-xl`) so logos look clean regardless of their original background colour.

---

## Status Lifecycle

| Status | Meaning |
|---|---|
| `Bookmarked` | Saved for later, not yet applied |
| `Applied` | Application submitted |
| `Interviewing` | Active interview process |
| `Offer` | Offer received |
| `Rejected` | Application declined |
| `Ghosted` | No response after follow-up |

Status can be changed inline directly from the table using the dropdown — changes are optimistically applied and rolled back on error.

---

## Deployment

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add the three env vars in **Vercel → Project → Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your production URL)
4. Add your production callback URL in Supabase Auth settings

---

## Security Notes

- Every Supabase query includes `.eq('user_id', userId)` — defence in depth alongside RLS
- Delete and destructive actions go through a Radix UI confirmation dialog
- Auth state is verified server-side via `supabase.auth.getUser()` before rendering protected pages
- The anon key is safe to expose publicly — all data access is gated by RLS policies
