import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/get-user'

export default async function Home() {
  const user = await getAuthUser()
  redirect(user ? '/board' : '/login')
}
