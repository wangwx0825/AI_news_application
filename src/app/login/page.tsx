'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border border-border bg-white/80 p-8 shadow-lg">
        <h1 className="mb-6 text-3xl font-bold">管理员登录</h1>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-3 outline-none"
              placeholder="请输入邮箱"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-3 outline-none"
              placeholder="请输入密码"
              required
            />
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-600">登录失败：{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-text px-5 py-3 text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </main>
  )
}