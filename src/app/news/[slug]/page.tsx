import EntryLayout from '@/components/EntryLayout'
import Section from '@/components/Section'
import InfoCard from '@/components/InfoCard'
import { supabase } from '@/lib/supabase'
import DeleteNewsButton from '@/components/DeleteNewsButton'

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
    { label: '状态', value: news.status ?? '' },
  ]

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
      
      <div className="mb-6">
        <a href="/news" className="text-sm text-link hover:underline">
          ← 返回新闻列表
        </a>
      </div>
      
      <Section title="摘要" defaultOpen>
        <p>{news.summary}</p>
      </Section>

      <Section title="正文" defaultOpen>
        <p>{news.content}</p>
      </Section>
    </EntryLayout>
  )
}