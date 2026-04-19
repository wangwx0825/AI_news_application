'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeleteFAQButton({
  slug,
}: {
  slug: string
}) {
  const router = useRouter()

  async function handleDelete() {
    const confirmed = window.confirm('确定要删除这条 FAQ 吗？')
    if (!confirmed) return

    const { error } = await supabase.from('faq').delete().eq('slug', slug)

    if (error) {
      alert(`删除失败：${error.message}`)
      return
    }

    router.push('/faq')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 transition hover:bg-red-50"
    >
      删除 FAQ
    </button>
  )
}