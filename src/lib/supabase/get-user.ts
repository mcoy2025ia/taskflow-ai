import { cache } from 'react'
import { createClient } from './server'

// React cache() deduplicates across layout + page within the same request.
// Without this, both DashboardLayout and BoardPage each call getUser()
// independently, resulting in two network roundtrips to Supabase Auth.
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
