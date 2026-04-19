'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewFAQPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [category, setCategory] = useState('')
  const [slug, setSlug] = useState('')
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

      const adminEmail = 'wangwx0825@gmail.com'

      if (user.email !== adminEmail) {
        router.push('/')
        return
      }

      setCheckingAuth(false)
    }

    checkAdmin()
  }, [router])

  function slugify(text: string) {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const adminEmail = 'wangwx0825@gmail.com'

    if (!user) {
      setSubmitting(false)
      router.push('/login')
      return
    }

    if (user.email !== adminEmail) {
      setSubmitting(false)
      router.push('/')
      return
    }

    const { error } = await supabase.from('faq').insert([
      {
        question,
        answer,
        category,
        slug,
      },
    ])

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/admin/faq')
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
      <h1 className="mb-6 text-3xl font-bold">新增 FAQ</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-white/80 p-6 shadow-lg"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            问题
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => {
              const value = e.target.value
              setQuestion(value)
              setSlug(slugify(value))
            }}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            placeholder="请输入问题"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            回答
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            rows={8}
            placeholder="请输入回答"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            分类
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            placeholder="例如：使用说明"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Slug
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            placeholder="例如：how-to-use-wiki"
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
          {submitting ? '提交中...' : '提交 FAQ'}
        </button>
      </form>
    </main>
  )
}