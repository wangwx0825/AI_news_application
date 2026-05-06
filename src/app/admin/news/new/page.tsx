'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/news-import/common'

export default function AdminNewNewsPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('')
  const [slug, setSlug] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function ensureUniqueSlug(baseSlug: string) {
    const normalizedSlug = slugify(baseSlug) || slugify(title) || 'news'

    for (let index = 0; index < 50; index += 1) {
      const candidate = index === 0 ? normalizedSlug : `${normalizedSlug}-${index + 1}`
      const { data, error } = await supabase
        .from('news')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle()

      if (error) throw error
      if (!data) return candidate
    }

    return `${normalizedSlug}-${Date.now().toString(36)}`
  }

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

    let uniqueSlug = slug

    try {
      uniqueSlug = await ensureUniqueSlug(slug)
    } catch (error) {
      setSubmitting(false)
      setErrorMessage(error instanceof Error ? error.message : '检查 Slug 失败')
      return
    }

    const { error } = await supabase.from('news').insert([
      {
        title,
        summary,
        content,
        author,
        slug: uniqueSlug,
        cover_image: coverImage,
        status: '已发布',
      },
    ])

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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p>检查权限中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">新增新闻</h1>
        <a
          href="/admin/news"
          className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
        >
          ← 返回新闻管理
        </a>
      </div>

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
            onChange={(e) => {
              const value = e.target.value
              setTitle(value)
              setSlug(slugify(value))
            }}
            className="w-full rounded-lg border border-border px-4 py-3 outline-none"
            placeholder="请输入新闻标题"
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
            placeholder="请输入新闻摘要"
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
            placeholder="请输入新闻正文"
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
            placeholder="请输入作者"
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
            placeholder="例如：new-product-launch"
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
            placeholder="请输入图片 URL"
          />
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600">提交失败：{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-block rounded-lg bg-text px-5 py-3 text-white transition duration-300 hover:scale-105 hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? '提交中...' : '提交新闻'}
        </button>
      </form>
    </main>
  )
}
