# Admin portal setup

The admin portal is available at `/admin` and uses server-only environment variables.

Add these variables in Vercel for Production and Preview:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_SESSION_SECRET=use-at-least-32-random-characters
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` must also remain configured.

Never use a `NEXT_PUBLIC_` prefix for the admin password, session secret, or service-role key. The service-role key bypasses Row Level Security and must remain server-only.

The admin portal can:

- show total users, total job applications, active users, and average jobs per user;
- search users and edit their name or email;
- send password recovery emails and magic links;
- delete a user, their job application rows, and files in their `resumes/<user-id>` folder.
