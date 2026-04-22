'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type NewsItem = {
  id: string
  title: string
  summary: string
  published_at: string
  author: string | null
  status: string | null
  slug: string
  cover_image: string | null
}

export default function NewsPage() {
  const [newsList, setNewsList] = useState<NewsItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function fetchNews() {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setNewsList((data as NewsItem[]) || [])
      setLoading(false)
    }

    fetchNews()
  }, [])

  const filteredNews = newsList.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p>加载中...</p>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-3xl font-bold">新闻</h1>
        <p>读取新闻失败：{errorMessage}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">新闻</h1>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索新闻标题..."
          className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 outline-none"
        />
      </div>

      <div className="space-y-6">
        {filteredNews.map((item) => (
          <a
            key={item.id}
            href={`/news/${item.slug}`}
            className="group block overflow-hidden rounded-2xl border border-border bg-white/70 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-xl"
          >
            {item.cover_image ? (
              <img
                src={item.cover_image}
                alt={item.title}
                className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            ) : null}

            <div className="p-5">
              <p className="text-sm text-gray-500">
                {item.published_at?.slice(0, 10)}
              </p>

              <h2 className="mt-2 text-2xl font-semibold text-text transition duration-300 group-hover:text-link">
                {item.title}
              </h2>

              <p className="mt-3 text-base leading-8 text-gray-700">
                {item.summary}
              </p>

              <div className="mt-4 text-sm text-gray-500">
                作者：{item.author ?? '未知'}　|　状态：{item.status ?? '未设置'}
              </div>
            </div>
          </a>
        ))}
      </div>

      {!filteredNews.length ? (
        <p className="mt-6 text-sm text-sub">没有找到符合条件的新闻。</p>
      ) : null}
    </main>
  )
}