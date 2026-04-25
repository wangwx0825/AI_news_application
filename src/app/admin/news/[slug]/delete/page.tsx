'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminDeleteNewsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function checkAdmin() {
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
        router.push('/')
        return
      }

      setCheckingAuth(false)
    }

    checkAdmin()
  }, [router])

  async function handleDelete() {
    setSubmitting(true)
    setErrorMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSubmitting(false)
      router.push('/login')
      return
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminUser) {
      setSubmitting(false)
      router.push('/')
      return
    }

    const { error } = await supabase.from('news').delete().eq('slug', slug)

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/admin/news')
    router.refresh()
  }

  if (checkingAuth) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p>检查权限中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="rounded-2xl border border-border bg-white/80 p-8 shadow-lg">
        <h1 className="mb-4 text-3xl font-bold text-red-600">删除新闻</h1>
        <p className="mb-6 text-sm leading-7 text-sub">
          你确定要删除这条新闻吗？此操作无法撤销。
        </p>

        {errorMessage ? (
          <p className="mb-4 text-sm text-red-600">删除失败：{errorMessage}</p>
        ) : null}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-5 py-3 text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? '删除中...' : '确认删除'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/news')}
            className="rounded-lg border border-border bg-white px-5 py-3 text-text transition hover:bg-white/80"
          >
            取消
          </button>
        </div>
      </div>
    </main>
  )
}