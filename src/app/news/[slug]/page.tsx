import EntryLayout from '@/components/EntryLayout'
import Section from '@/components/Section'
import InfoCard from '@/components/InfoCard'
import { supabase } from '@/lib/supabase'

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: news, error } = await supabase
    .from('news')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !news) {
    return <div className="mx-auto max-w-5xl px-6 py-10">未找到这条新闻。</div>
  }

  const breadcrumbItems = [
    { label: '首页', href: '/' },
    { label: '新闻', href: '/news' },
    { label: news.title },
  ]

  const infoCardItems = [
    { label: '发布时间', value: news.published_at?.slice(0, 10) ?? '' },
    { label: '作者', value: news.author ?? '' },
    { label: '来源', value: news.source ?? '' },
    { label: '状态', value: news.status ?? '' },
  ]

  const isOpenAI = news.source === 'OpenAI'
  const hasRealContent =
    news.content &&
    news.content.trim() &&
    news.content.trim() !== news.summary?.trim() &&
    !news.content.includes('原文链接：')

  return (
    <EntryLayout
      breadcrumbItems={breadcrumbItems}
      title={news.title}
      infoCard={<InfoCard title="新闻信息" items={infoCardItems} />}
    >
      {news.cover_image ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-border">
          <img
            src={news.cover_image}
            alt={news.title}
            className="h-[320px] w-full object-cover"
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <a href="/news" className="text-link hover:underline">
          ← 返回新闻列表
        </a>

        {news.source_url ? (
          <a
            href={news.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline"
          >
            查看原文 →
          </a>
        ) : null}
      </div>

      <Section title={isOpenAI ? '摘要' : '摘要'} defaultOpen>
        <p className="whitespace-pre-line leading-7 text-foreground/90">
          {news.summary || '暂无摘要'}
        </p>
      </Section>

      {!isOpenAI && hasRealContent ? (
        <Section title="正文" defaultOpen>
          <div className="whitespace-pre-line leading-8 text-[15px] text-foreground/95">
            {news.content}
          </div>
        </Section>
      ) : null}

      {isOpenAI ? (
        <div className="mt-6 rounded-2xl border border-border bg-white/70 p-4 text-sm text-sub">
          该来源当前主要展示摘要内容，完整文章请查看原文。
        </div>
      ) : null}
    </EntryLayout>
  )
}