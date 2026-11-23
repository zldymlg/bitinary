import { createClient } from '@supabase/supabase-js'
import { isBizPreview } from './forced'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or SUPABASE_URL and SUPABASE_ANON_KEY.')
}

// Public client key lang ang ligtas ilagay sa browser; RLS ang dapat magpatupad ng access.
const preview = isBizPreview()

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: !preview,
    autoRefreshToken: !preview,
    detectSessionInUrl: !preview,
  },
  ...(preview && { global: { fetch: async () => new Response('{"message":"Read-only business preview"}', { status: 403, headers: { 'Content-Type': 'application/json' } }) } }),
})
