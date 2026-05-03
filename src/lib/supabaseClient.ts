/**
 * supabaseClient.ts
 * Singleton Supabase client for browser use.
 * Uses the publishable (anon) key — safe to expose publicly.
 * All data access is protected by Row Level Security policies.
 */
import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)
