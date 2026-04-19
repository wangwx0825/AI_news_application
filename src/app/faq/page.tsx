'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type FAQItem = {
  id: string
  question: string
  answer: string
  category: string | null
  slug: string
  updated_at: string
}

export default function FAQPage() {
  const [faqList, setFaqList] = useState<FAQItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function fetchFAQ() {
      const { data, error } = await supabase
        .from('faq')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setFaqList((data as FAQItem[]) || [])
      setLoading(false)
    }

    fetchFAQ()
  }, [])

  const filteredFAQ = faqList.filter((item) =>
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">FAQ</h1>

        <a
          href="/faq/new"
          className="rounded-lg bg-text px-4 py-2 text-sm text-white no-underline transition hover:opacity-90"
        >
          + 新增 FAQ
        </a>
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

      <div className="space-y-4">
        {filteredFAQ.map((item) => (
          <a
            key={item.id}
            href={`/faq/${item.slug}`}
            className="block rounded-2xl border border-border bg-white/75 p-5 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl"
          >
            <div className="text-sm text-sub">{item.category}</div>
            <h2 className="mt-2 text-xl font-semibold text-text">
              {item.question}
            </h2>
            <p className="mt-3 text-base leading-7 text-sub">{item.answer}</p>
          </a>
        ))}
      </div>

      {!filteredFAQ.length ? (
        <p className="mt-6 text-sm text-sub">没有找到符合条件的 FAQ。</p>
      ) : null}
    </main>
  )
}