'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EditFAQPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [category, setCategory] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function checkAdminAndFetchFAQ() {
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

      const { data, error } = await supabase
        .from('faq')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error || !data) {
        setErrorMessage('读取 FAQ 失败')
        setLoading(false)
        return
      }

      setQuestion(data.question ?? '')
      setAnswer(data.answer ?? '')
      setCategory(data.category ?? '')
      setNewSlug(data.slug ?? '')
      setLoading(false)
    }

    if (slug) {
      checkAdminAndFetchFAQ()
    }
  }, [slug, router])

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

    const { error } = await supabase
      .from('faq')
      .update({
        question,
        answer,
        category,
        slug: newSlug,
      })
      .eq('slug', slug)

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/admin/faq')
    router.refresh()
  }

  if (checkingAuth || loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>加载中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">编辑 FAQ</h1>

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
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
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
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            Slug
          </label>
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            required
          />
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-text px-5 py-3 text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? '保存中...' : '保存修改'}
        </button>
      </form>
    </main>
  )
}