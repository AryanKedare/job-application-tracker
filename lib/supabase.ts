// lib/supabase.ts
// Migrated from deprecated @supabase/auth-helpers-nextjs to @supabase/ssr
// Run: npm install @supabase/ssr && npm uninstall @supabase/auth-helpers-nextjs
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
