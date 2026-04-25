'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type FAQItem = {
  id: string
  question: string
  answer: string
  category: string | null
  slug: string
}

export default function FAQPage() {
  const [faqList, setFaqList] = useState<FAQItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function fetchFAQs() {
      const { data, error } = await supabase
        .from('faq')
        .select('*')

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setFaqList((data as FAQItem[]) || [])
      setLoading(false)
    }

    fetchFAQs()
  }, [])

  const filteredFAQs = faqList.filter((item) =>
    item.question.toLowerCase().includes(search.toLowerCase())
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
        <h1 className="mb-6 text-3xl font-bold">FAQ</h1>
        <p>读取 FAQ 失败：{errorMessage}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">FAQ</h1>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索 FAQ 问题..."
          className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 outline-none"
        />
      </div>

      <div className="space-y-6">
        {filteredFAQs.map((item) => (
          <a
            key={item.id}
            href={`/faq/${item.slug}`}
            className="block rounded-2xl border border-border bg-white/70 p-5 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-xl"
          >
            <p className="text-sm text-gray-500">
              {item.category || '未分类'}
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-text transition duration-300 hover:text-link">
              {item.question}
            </h2>

            <p className="mt-3 text-base leading-8 text-gray-700 line-clamp-3">
              {item.answer}
            </p>
          </a>
        ))}
      </div>

      {!filteredFAQs.length ? (
        <p className="mt-6 text-sm text-sub">没有找到符合条件的 FAQ。</p>
      ) : null}
    </main>
  )
}