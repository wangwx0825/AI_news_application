'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EditNewsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function checkAdminAndFetchNews() {
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
        .from('news')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error || !data) {
        setErrorMessage('读取新闻失败')
        setLoading(false)
        return
      }

      setTitle(data.title ?? '')
      setSummary(data.summary ?? '')
      setContent(data.content ?? '')
      setAuthor(data.author ?? '')
      setNewSlug(data.slug ?? '')
      setCoverImage(data.cover_image ?? '')
      setLoading(false)
    }

    if (slug) {
      checkAdminAndFetchNews()
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
      .from('news')
      .update({
        title,
        summary,
        content,
        author,
        slug: newSlug,
        cover_image: coverImage,
      })
      .eq('slug', slug)

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push(`/admin/news`)
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
      <h1 className="mb-6 text-3xl font-bold">编辑新闻</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-white/80 p-6 shadow-lg"
      >
        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            摘要
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            rows={4}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            正文
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            rows={8}
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            作者
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
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

        <div>
          <label className="mb-2 block text-sm font-medium text-text">
            封面图链接
          </label>
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
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