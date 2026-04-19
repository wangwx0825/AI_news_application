'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminNewUserPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [email, setEmail] = useState('')
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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

    const { error } = await supabase.from('admin_users').insert([
      {
        email,
      },
    ])

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/admin/users')
    router.refresh()
  }

  if (checkingAuth) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>检查权限中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">新增管理员</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-white/80 p-6 shadow-lg"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            管理员邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            placeholder="请输入管理员邮箱"
            required
          />
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600">提交失败：{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-text px-5 py-3 text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? '提交中...' : '新增管理员'}
        </button>
      </form>
    </main>
  )
}