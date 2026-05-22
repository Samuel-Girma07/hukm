import { createBrowserClient } from '@supabase/ssr'
import { env } from '../env'

export function createClient() {
  return createBrowserClient(
    env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
