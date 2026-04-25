'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminEntryButton() {
  const router = useRouter()

  async function handleAdminClick() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminUser) {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
      return
    }

    router.push('/admin')
  }

  return (
    <button
      type="button"
      onClick={handleAdminClick}
      className="inline-block text-link transition duration-300 hover:scale-110 hover:underline"
    >
      后台
    </button>
  )
}