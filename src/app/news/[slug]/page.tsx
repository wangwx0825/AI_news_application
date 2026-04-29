import EntryLayout from '@/components/EntryLayout'
import InfoCard from '@/components/InfoCard'
import NewsContentBlocks, {
  type NewsContentBlock,
} from '@/components/NewsContentBlocks'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
    { label: '来源', value: news.source ?? '' },
    { label: '状态', value: news.status ?? '' },
  ]

  const contentBlocks = Array.isArray(news.content_blocks)
    ? (news.content_blocks as NewsContentBlock[])
    : []

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
            className="max-h-[520px] w-full object-cover"
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/news" className="text-link hover:underline">
          ← 返回新闻列表
        </Link>

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

      <NewsContentBlocks
        blocks={contentBlocks}
        coverImage={news.cover_image}
        fallbackContent={news.content}
        sourceUrl={news.source_url}
      />
    </EntryLayout>
  )
}
